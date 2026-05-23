import { ilike } from 'drizzle-orm';
import { users } from '../schema/users.js';
import type { DatabaseClient } from '../client/index.js';
import { BaseRepository } from './base.repository.js';

export class UsersRepository extends BaseRepository<typeof users> {
  constructor(db: DatabaseClient) {
    super(db, users, users.id);
  }

  async findByEmail(email: string) {
    const rows = await this.db.select().from(users).where(ilike(users.email, email)).limit(1);
    return rows[0] ?? null;
  }
}