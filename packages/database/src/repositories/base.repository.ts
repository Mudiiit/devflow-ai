import { desc, eq, sql } from 'drizzle-orm';

import type {
  InferInsertModel,
  InferSelectModel,
  Table,
} from 'drizzle-orm';

import type { AnyPgColumn } from 'drizzle-orm/pg-core';

import type {
  DatabaseClient,
  DatabaseTransaction,
} from '../client/index.js';

import {
  createOffsetPaginationResult,
  type OffsetPaginationInput,
  type OffsetPaginationResult,
} from './pagination.js';

export abstract class BaseRepository<
  TTable extends Table,
  TSelect = InferSelectModel<TTable>,
  TInsert = InferInsertModel<TTable>,
> {
  protected constructor(
    protected readonly db: DatabaseClient,
    protected readonly table: TTable,
    protected readonly idColumn: AnyPgColumn,
  ) {}

  async findById(id: string): Promise<TSelect | null> {
    const rows = (await this.db
      .select()
      .from(this.table as never)
      .where(eq(this.idColumn, id))
      .limit(1)) as unknown as TSelect[];

    return rows[0] ?? null;
  }

  async findMany(limit = 50): Promise<TSelect[]> {
    const rows = (await this.db
      .select()
      .from(this.table as never)
      .limit(limit)) as unknown as TSelect[];

    return rows;
  }

  async findPage(
    input: OffsetPaginationInput = {},
  ): Promise<OffsetPaginationResult<TSelect>> {
    const { page, pageSize } =
      createOffsetPaginationResult([], 0, input);

    const offset = (page - 1) * pageSize;

    const items = (await this.db
      .select()
      .from(this.table as never)
      .orderBy(desc(this.idColumn))
      .limit(pageSize)
      .offset(offset)) as unknown as TSelect[];

    const total = await this.countAll();

    return createOffsetPaginationResult(items, total, {
      page,
      pageSize,
    });
  }

  async create(input: TInsert): Promise<TSelect> {
    const rows = (await this.db
      .insert(this.table)
      .values(input as never)
      .returning()) as unknown as TSelect[];

    return rows[0]!;
  }

  async updateById(
    id: string,
    patch: Partial<TInsert>,
  ): Promise<TSelect | null> {
    const rows = (await this.db
      .update(this.table)
      .set({
        ...(patch as object),
        updatedAt: new Date(),
      })
      .where(eq(this.idColumn, id))
      .returning()) as unknown as TSelect[];

    return rows[0] ?? null;
  }

  async deleteById(id: string): Promise<TSelect | null> {
    const rows = (await this.db
      .delete(this.table)
      .where(eq(this.idColumn, id))
      .returning()) as unknown as TSelect[];

    return rows[0] ?? null;
  }

  async countAll(): Promise<number> {
    const rows = (await this.db
      .select({
        count: sql<number>`count(*)`,
      })
      .from(this.table as never)) as unknown as {
      count: number;
    }[];

    return Number(rows[0]?.count ?? 0);
  }

  protected withTransaction<T>(
    callback: (tx: DatabaseTransaction) => Promise<T>,
  ): Promise<T> {
    return this.db.transaction(callback);
  }
}