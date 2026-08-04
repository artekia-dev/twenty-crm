import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';

import { pipeline } from 'node:stream/promises';

import { type Request, type Response } from 'express';

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

    const workspaceId = request.workspace?.id;

    if (!workspaceId) throw new NotFoundException();

    const documento = await this.documentoService.obtener({
      workspaceId,
      objeto,
      recordId,
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
}
