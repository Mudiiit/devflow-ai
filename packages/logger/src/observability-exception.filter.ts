import {
  Catch,
  HttpException,
  HttpStatus,
  Injectable,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { MetricsService } from './metrics.service.js';
import { StructuredLoggerService } from './structured-logger.service.js';

const normalizeError = (error: unknown): Record<string, unknown> => {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    message: 'Unknown error',
    value: error,
  };
};

@Catch()
@Injectable()
export class ObservabilityExceptionFilter implements ExceptionFilter {
  constructor(
    private readonly logger: StructuredLoggerService,
    private readonly metricsService: MetricsService,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() !== 'http') {
      this.logger.event('error', 'unhandled.non_http_exception', {}, exception instanceof Error ? exception : undefined);
      return;
    }

    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const statusCode = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    this.metricsService.increment('devflow_http_errors_total', {
      method: request.method,
      status: statusCode,
    });
    this.logger.event('error', 'http.request.failed', {
      method: request.method,
      path: request.originalUrl,
      statusCode,
      error: normalizeError(exception),
    }, exception instanceof Error ? exception : undefined);

    response.status(statusCode).json({
      statusCode,
      message: exception instanceof HttpException ? exception.message : 'Internal server error',
      error: normalizeError(exception),
    });
  }
}