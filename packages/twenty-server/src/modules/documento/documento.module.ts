import { Module } from '@nestjs/common';

import { DocumentoController } from 'src/modules/documento/controllers/documento.controller';
import { DocumentoService } from 'src/modules/documento/services/documento.service';

@Module({
  controllers: [DocumentoController],
  providers: [DocumentoService],
})
export class DocumentoModule {}
