import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import type { Response } from 'express';
import { HealthService } from './health.service.js';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('live')
  async live(@Res({ passthrough: true }) response: Response): Promise<Record<string, unknown>> {
    const payload = await this.healthService.live();
    response.status(HttpStatus.OK);
    return payload;
  }

  @Get('ready')
  async ready(@Res({ passthrough: true }) response: Response): Promise<Record<string, unknown>> {
    const payload = await this.healthService.ready();
    response.status(payload.status === 'ok' ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);
    return payload;
  }
}