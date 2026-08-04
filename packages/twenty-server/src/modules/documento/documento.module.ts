import { Module } from '@nestjs/common';

import { AuthModule } from 'src/engine/core-modules/auth/auth.module';
import { WorkspaceCacheStorageModule } from 'src/engine/workspace-cache-storage/workspace-cache-storage.module';
import { DocumentoController } from 'src/modules/documento/controllers/documento.controller';
import { DocumentoService } from 'src/modules/documento/services/documento.service';

// The two guards on the controller are not self-contained: they need the token
// service and the workspace cache, and Nest only resolves what the module
// importing them can see.
@Module({
  imports: [AuthModule, WorkspaceCacheStorageModule],
  controllers: [DocumentoController],
  providers: [DocumentoService],
})
export class DocumentoModule {}
