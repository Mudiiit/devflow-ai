import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable } from '@nestjs/common';
import type { ObservabilityRequestContext } from './types.js';

@Injectable()
export class RequestContextService {
  private readonly storage = new AsyncLocalStorage<ObservabilityRequestContext>();

  run<T>(context: ObservabilityRequestContext, callback: () => T): T {
    return this.storage.run(context, callback);
  }

  current(): ObservabilityRequestContext | undefined {
    return this.storage.getStore();
  }
}