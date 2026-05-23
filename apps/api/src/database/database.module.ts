import { Module } from '@nestjs/common';
import { createDatabaseClient, type DatabaseClient } from '@devflow/database';
import { AuthSessionsRepository, GithubInstallationsRepository, OauthStatesRepository, RepositoriesRepository, UsersRepository } from '@devflow/database';
import { DATABASE_CLIENT } from './database.constants.js';

const repositoryProviders = [
  {
    provide: UsersRepository,
    inject: [DATABASE_CLIENT],
    useFactory: (db: DatabaseClient) => new UsersRepository(db),
  },
  {
    provide: AuthSessionsRepository,
    inject: [DATABASE_CLIENT],
    useFactory: (db: DatabaseClient) => new AuthSessionsRepository(db),
  },
  {
    provide: OauthStatesRepository,
    inject: [DATABASE_CLIENT],
    useFactory: (db: DatabaseClient) => new OauthStatesRepository(db),
  },
  {
    provide: GithubInstallationsRepository,
    inject: [DATABASE_CLIENT],
    useFactory: (db: DatabaseClient) => new GithubInstallationsRepository(db),
  },
  {
    provide: RepositoriesRepository,
    inject: [DATABASE_CLIENT],
    useFactory: (db: DatabaseClient) => new RepositoriesRepository(db),
  },
];

@Module({
  providers: [
    {
      provide: DATABASE_CLIENT,
      useFactory: () => createDatabaseClient(),
    },
    ...repositoryProviders,
  ],
  exports: [DATABASE_CLIENT, ...repositoryProviders.map((provider) => provider.provide)],
})
export class DatabaseModule {}