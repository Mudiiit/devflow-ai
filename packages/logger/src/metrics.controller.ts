import { Controller, Get, Header, HttpStatus, Res } from '@nestjs/common';
import type { Response } from 'express';
import { MetricsService } from './metrics.service.js';

@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  @Header('Content-Type', 'text/plain; charset=utf-8')
  metrics(@Res({ passthrough: true }) response: Response): string {
    response.status(HttpStatus.OK);
    return this.metricsService.toPrometheusText();
  }
}