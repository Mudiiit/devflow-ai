import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { createRedisConnection, isRedisConnectionEnabled, serverEnv } from '@devflow/config';

@Injectable()
export class CacheService implements OnApplicationShutdown {
  private readonly memory = new Map<string, { value: string; expiresAt: number }>();
  private readonly connection: any | null;

  constructor() {
    this.connection = isRedisConnectionEnabled(serverEnv.REDIS_URL)
      ? createRedisConnection(serverEnv.REDIS_URL!, 'devflow-api-cache')
      : null;
  }

  async getJson<T>(key: string): Promise<T | null> {
    if (this.connection) {
      const value = await this.connection.get(key);
      return value ? (JSON.parse(value) as T) : null;
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
      await this.connection.set(key, serialized, 'EX', ttlSeconds);
      return;
    }

    this.memory.set(key, {
      value: serialized,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.connection) {
      await this.connection.quit();
    }
    this.memory.clear();
  }
}
