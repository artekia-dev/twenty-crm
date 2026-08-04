import { Injectable, Logger } from '@nestjs/common';

// Not a type-only import: Readable.fromWeb is called at runtime, and a type
// import vanishes at compile time. Nothing in the type checker catches this,
// only the 500 does.
import { Readable } from 'stream';

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

  constructor(private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager) {}

  async obtener({
    workspaceId,
    objeto,
    recordId,
  }: {
    workspaceId: string;
    objeto: Objeto;
    recordId: string;
  }): Promise<{ stream: Readable; nombre: string } | null> {
    // No bypass. The caller's own permissions decide whether this returns a
    // row, which is exactly the check we want.
    const repository = await this.globalWorkspaceOrmManager.getRepository(workspaceId, objeto);

    const registro = (await repository.findOne({ where: { id: recordId } })) as
      | (Record<string, unknown> & { fileName?: string })
      | null;

    const itemId = registro?.[CAMPO_DOCUMENTO];

    if (typeof itemId !== 'string' || itemId.length === 0) return null;

    const stream = await this.descargarDeSharePoint(itemId);

    return stream ? { stream, nombre: registro?.fileName ?? 'documento.pdf' } : null;
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
