import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { createRedisConnection, isRedisConnectionEnabled, serverEnv } from '@devflow/config';

@Injectable()
export class CacheService implements OnApplicationShutdown {
  private readonly memory = new Map<string, { value: string; expiresAt: number }>();
  private connection: any | null = null;

  constructor() {
    if (!isRedisConnectionEnabled(serverEnv.REDIS_URL)) {
      return;
    }

    try {
      this.connection = createRedisConnection(serverEnv.REDIS_URL!, 'devflow-api-cache');
      if (this.connection && typeof this.connection.on === 'function') {
        this.connection.on('error', (error: unknown) => {
          console.warn('[api] cache redis error, using memory fallback: %s', error instanceof Error ? error.message : String(error));
        });
      }
    } catch (error) {
      this.connection = null;
      console.warn('[api] cache redis initialization failed, using memory fallback: %s', error instanceof Error ? error.message : String(error));
    }
  }

  async getJson<T>(key: string): Promise<T | null> {
    if (this.connection) {
      try {
        const value = await this.connection.get(key);
        return value ? (JSON.parse(value) as T) : null;
      } catch {
        this.connection = null;
      }
    }

    const entry = this.memory.get(key);
    if (!entry || entry.expiresAt <= Date.now()) {
      this.memory.delete(key);
      return null;
    }

    return JSON.parse(entry.value) as T;
  }

  async setJson(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    const serialized = JSON.stringify(value);

    if (this.connection) {
      try {
        await this.connection.set(key, serialized, 'EX', ttlSeconds);
        return;
      } catch {
        this.connection = null;
      }
    }

    this.memory.set(key, {
      value: serialized,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.connection) {
      try {
        await this.connection.quit();
      } catch {
        // ignore cache redis shutdown failures
      }
    }
    this.memory.clear();
  }
}
