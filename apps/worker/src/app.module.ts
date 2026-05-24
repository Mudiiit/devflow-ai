import { Module } from '@nestjs/common';
import { ObservabilityModule } from '@devflow/logger';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module.js';
import { DATABASE_CLIENT } from './database/database.constants.js';
import { ReviewPipelineModule } from './review/review-pipeline.module.js';

@Module({
  imports: [
    DatabaseModule,
    ObservabilityModule.register({
      serviceName: 'worker',
      databaseClientToken: DATABASE_CLIENT,
    }),
    ReviewPipelineModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
