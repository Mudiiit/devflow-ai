import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { SessionService } from '../services/session.service.js';

@Injectable()
export class AuthSessionInterceptor implements NestInterceptor {
  constructor(private readonly sessionService: SessionService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{ authSession?: { session?: { id: string } } }>();

    return next.handle().pipe(
      tap(() => {
        const sessionId = request.authSession?.session?.id;

        if (sessionId) {
          void this.sessionService.touchSession(sessionId);
        }
      }),
    );
  }
}