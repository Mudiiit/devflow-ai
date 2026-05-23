import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ReviewPipelineModule } from './review/review-pipeline.module.js';

@Module({
  imports: [ReviewPipelineModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
