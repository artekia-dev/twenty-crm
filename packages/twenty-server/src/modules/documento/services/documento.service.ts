import { Injectable, Logger } from '@nestjs/common';

// Not a type-only import: Readable.fromWeb is called at runtime, and a type
// import vanishes at compile time. Nothing in the type checker catches this,
// only the 500 does.
import { Readable } from 'stream';

import { type UserWorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { UserRoleService } from 'src/engine/metadata-modules/user-role/user-role.service';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';

// Serves the scanned document behind an invoice or delivery note.
//
// WHY THE PERMISSION CHECK IS NOT HERE
// ------------------------------------
// Because it does not need to be, and that is the point. The record is read
// through the ordinary workspace repository, so the company scope in the query
// builder already applies: a caller who cannot see the invoice gets no row, and
// no row means no file. Writing a second check here would be a second thing to
// keep in step with the first.
//
// This replaces a much longer way round from before the fork — signed
// short-lived URLs, a public route, pdf.js from a CDN — all of which existed to
// smuggle a session into a sandboxed iframe. Owning the code removes the need
// for every one of those pieces.

type Objeto = 'factura' | 'albaran';

const CAMPO_DOCUMENTO = 'sharepointItemId';

@Injectable()
export class DocumentoService {
  private readonly logger = new Logger(DocumentoService.name);

  constructor(
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
    private readonly userRoleService: UserRoleService,
  ) {}

  async obtener({
    authContext,
    objeto,
    recordId,
  }: {
    authContext: UserWorkspaceAuthContext;
    objeto: Objeto;
    recordId: string;
  }): Promise<{ stream: Readable; nombre: string } | null> {
    const encontrado = await this.itemIdDe({ authContext, objeto, recordId });

    if (!encontrado) return null;

    const stream = await this.descargarDeSharePoint(encontrado.itemId);

    return stream ? { stream, nombre: encontrado.fileName } : null;
  }

  // Which SharePoint file backs this record, read AS THE CALLER.
  //
  // Opened in the caller's workspace context, not a system one. That is the
  // whole design: their company scope applies to this read, so an invoice they
  // cannot see returns nothing — and everything downstream of this method
  // inherits that check for free, without writing it twice.
  //
  // The context is passed in rather than read from ambient storage: the
  // middleware that populates that storage is registered for the GraphQL and
  // REST routes, not for these. Handing it a system context instead would
  // quietly disable the only permission check these endpoints have.
  private async itemIdDe({
    authContext,
    objeto,
    recordId,
  }: {
    authContext: UserWorkspaceAuthContext;
    objeto: Objeto;
    recordId: string;
  }): Promise<{ itemId: string; fileName: string } | null> {
    const workspaceId = authContext.workspace.id;
    // The repository has to be told which role is asking. Without it the ORM
    // assumes no permissions at all and refuses the read, which is the safe
    // default but not the answer here.
    const roleId = await this.userRoleService.getRoleIdForUserWorkspace({
      userWorkspaceId: authContext.userWorkspaceId,
      workspaceId,
    });

    if (!roleId) return null;

    const registro = await this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const repository = await this.globalWorkspaceOrmManager.getRepository(
          workspaceId,
          objeto,
          { intersectionOf: [roleId] },
        );

        return (await repository.findOne({ where: { id: recordId } })) as
          | (Record<string, unknown> & { fileName?: string })
          | null;
      },
      authContext,
    );

    const itemId = registro?.[CAMPO_DOCUMENTO];

    if (typeof itemId !== 'string' || itemId.length === 0) return null;

    return { itemId, fileName: registro?.fileName ?? 'documento.pdf' };
  }

  // Asks the watcher to read this document again, and waits for it.
  //
  // Twenty does not do the reading: it has no OCR, no extractor and no idea
  // where the file lives. The watcher has all three and does exactly this every
  // day. Duplicating any of it here would mean two paths to keep in step, and
  // the second one always falls behind.
  //
  // Synchronous on purpose, even though it takes seconds. Somebody pressed a
  // button and is watching the screen: they want the result, not a receipt.
  async releer({
    authContext,
    objeto,
    recordId,
  }: {
    authContext: UserWorkspaceAuthContext;
    objeto: Objeto;
    recordId: string;
  }): Promise<{ ok: true } | { ok: false; motivo: string }> {
    const url = process.env.WATCHER_URL?.replace(/\/$/, '');
    const token = process.env.WATCHER_TOKEN;

    if (!url || !token) {
      return { ok: false, motivo: 'La relectura no está configurada en el servidor.' };
    }

    // The same read as the viewer, so the same permissions apply: a caller who
    // cannot see the invoice cannot have it reprocessed either.
    const documento = await this.itemIdDe({ authContext, objeto, recordId });

    if (!documento) return { ok: false, motivo: 'Este registro no tiene documento.' };

    // Typed rather than inlined into JSON.stringify, which accepts anything and
    // would happily send an object where the watcher expects a string — it did,
    // and the only sign was the watcher answering "falta itemId".
    const peticion: { itemId: string } = { itemId: documento.itemId };

    try {
      const respuesta = await fetch(`${url}/releer`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-watcher-token': token },
        body: JSON.stringify(peticion),
        // Reading a document is OCR plus a language model: seconds, sometimes
        // tens of them. Cutting it off early would report a failure for work
        // that is going to finish anyway.
        signal: AbortSignal.timeout(120_000),
      });

      if (!respuesta.ok) {
        const cuerpo = (await respuesta.text()).slice(0, 300);

        this.logger.error(`Rescan failed for ${objeto} ${recordId}: ${cuerpo}`);

        return { ok: false, motivo: 'El documento no se pudo leer. Inténtalo de nuevo.' };
      }

      return { ok: true };
    } catch (error) {
      this.logger.error(
        `Rescan could not reach the watcher: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      return { ok: false, motivo: 'El servicio de lectura no responde.' };
    }
  }

  private async token(): Promise<string | null> {
    const tenant = process.env.SHAREPOINT_TENANT_ID;
    const clientId = process.env.SHAREPOINT_CLIENT_ID;
    const clientSecret = process.env.SHAREPOINT_CLIENT_SECRET;

    if (!tenant || !clientId || !clientSecret) {
      this.logger.error('SharePoint credentials are not configured.');

      return null;
    }

    const respuesta = await fetch(
      `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          scope: 'https://graph.microsoft.com/.default',
          grant_type: 'client_credentials',
        }),
      },
    );

    if (!respuesta.ok) {
      this.logger.error(`SharePoint refused the token request: ${respuesta.status}`);

      return null;
    }

    const json = (await respuesta.json()) as { access_token?: string };

    return json.access_token ?? null;
  }

  private async descargarDeSharePoint(itemId: string): Promise<Readable | null> {
    const driveId = process.env.SHAREPOINT_DRIVE_ID;
    const token = await this.token();

    if (!driveId || !token) return null;

    const respuesta = await fetch(
      `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${encodeURIComponent(itemId)}/content`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    if (!respuesta.ok || !respuesta.body) {
      this.logger.error(`SharePoint returned ${respuesta.status} for item ${itemId}`);

      return null;
    }

    return Readable.fromWeb(respuesta.body as Parameters<typeof Readable.fromWeb>[0]);
  }
}
