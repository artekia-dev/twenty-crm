import {
  Controller,
  Get,
  Logger,
  NotFoundException,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';

import { pipeline } from 'node:stream/promises';

import { type Request, type Response } from 'express';

import { buildUserAuthContext } from 'src/engine/core-modules/auth/utils/build-user-auth-context.util';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';
import { WorkspaceAuthGuard } from 'src/engine/guards/workspace-auth.guard';
import { DocumentoService } from 'src/modules/documento/services/documento.service';

// Serves the PDF of an invoice or delivery note straight to the browser.
//
// Same origin as the application, so the browser's own PDF viewer handles
// zooming, paging and full screen. That is the whole reason this is a few lines
// instead of the signed-URL dance it replaces: nothing here has to smuggle a
// session past a sandbox.
//
// `inline` rather than `attachment` on purpose — the point is to read it in
// place, not to download a copy of every document that gets opened.
@Controller('documento')
@UseGuards(JwtAuthGuard, WorkspaceAuthGuard)
export class DocumentoController {
  private readonly logger = new Logger(DocumentoController.name);

  constructor(private readonly documentoService: DocumentoService) {}

  @Get(':objeto/:recordId')
  async ver(
    @Param('objeto') objeto: string,
    @Param('recordId') recordId: string,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    if (objeto !== 'factura' && objeto !== 'albaran') {
      throw new NotFoundException('Only invoices and delivery notes have documents.');
    }

    // Everything here was put on the request by the guards above, so reaching
    // this line already means an authenticated member of the workspace.
    if (
      !request.workspace ||
      !request.user ||
      !request.workspaceMember ||
      !request.workspaceMemberId ||
      !request.userWorkspaceId
    ) {
      throw new NotFoundException();
    }

    const authContext = buildUserAuthContext({
      workspace: request.workspace,
      userWorkspaceId: request.userWorkspaceId,
      user: request.user,
      workspaceMemberId: request.workspaceMemberId,
      workspaceMember: request.workspaceMember,
      companyScope: request.companyScope,
    });

    // Logged here on purpose. Whatever wraps this route swallows the trace and
    // answers a bare 500, which says nothing about what actually broke.
    const documento = await this.documentoService
      .obtener({ authContext, objeto, recordId })
      .catch((error: unknown) => {
        this.logger.error(
          `Fetching ${objeto} ${recordId} failed: ${
            error instanceof Error ? `${error.message}\n${error.stack}` : String(error)
          }`,
        );

        throw error;
      });

    // One answer for "does not exist", "has no file" and "not yours". Telling
    // them apart would let someone map which invoices exist in a company they
    // cannot see, just by watching which ids answer differently.
    if (!documento) throw new NotFoundException();

    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(documento.nombre)}"`,
    );
    // These documents are per-user by permission, so no shared cache may keep
    // a copy.
    response.setHeader('Cache-Control', 'private, no-store');

    await pipeline(documento.stream, response);
  }

  // Reads the document again, now, and answers with the outcome.
  //
  // The alternative was to flag the record and let the watcher pick it up on
  // its next pass, which is simpler but makes somebody wait up to a minute
  // staring at a screen for something they just asked for. A person pressing a
  // button is not a background job.
  @Post(':objeto/:recordId/releer')
  async releer(
    @Param('objeto') objeto: string,
    @Param('recordId') recordId: string,
    @Req() request: Request,
  ): Promise<{ ok: boolean; motivo?: string }> {
    if (objeto !== 'factura' && objeto !== 'albaran') {
      throw new NotFoundException('Only invoices and delivery notes have documents.');
    }

    if (
      !request.workspace ||
      !request.user ||
      !request.workspaceMember ||
      !request.workspaceMemberId ||
      !request.userWorkspaceId
    ) {
      throw new NotFoundException();
    }

    const authContext = buildUserAuthContext({
      workspace: request.workspace,
      userWorkspaceId: request.userWorkspaceId,
      user: request.user,
      workspaceMemberId: request.workspaceMemberId,
      workspaceMember: request.workspaceMember,
      companyScope: request.companyScope,
    });

    const resultado = await this.documentoService
      .releer({ authContext, objeto, recordId })
      .catch((error: unknown) => {
        this.logger.error(
          `Rescan of ${objeto} ${recordId} failed: ${
            error instanceof Error ? `${error.message}\n${error.stack}` : String(error)
          }`,
        );

        return { ok: false as const, motivo: 'No se pudo releer el documento.' };
      });

    // 200 with ok:false rather than an error status: the reasons here are
    // things the person can act on — not configured, no document, service
    // down — and each deserves its own sentence on screen instead of a status
    // code the browser turns into "failed to fetch".
    return resultado.ok ? { ok: true } : { ok: false, motivo: resultado.motivo };
  }
}
