import { Module } from '@nestjs/common';
import {
  AiReviewChunksRepository,
  AuthSessionsRepository,
  createDatabaseClient,
  GithubInstallationsRepository,
  OauthStatesRepository,
  PullRequestsRepository,
  RepositoriesRepository,
  ReviewCommentsRepository,
  ReviewJobsRepository,
  ReviewMetricsRepository,
  UsersRepository,
  type DatabaseClient,
} from '@devflow/database';
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
  {
    provide: PullRequestsRepository,
    inject: [DATABASE_CLIENT],
    useFactory: (db: DatabaseClient) => new PullRequestsRepository(db),
  },
  {
    provide: ReviewJobsRepository,
    inject: [DATABASE_CLIENT],
    useFactory: (db: DatabaseClient) => new ReviewJobsRepository(db),
  },
  {
    provide: ReviewCommentsRepository,
    inject: [DATABASE_CLIENT],
    useFactory: (db: DatabaseClient) => new ReviewCommentsRepository(db),
  },
  {
    provide: AiReviewChunksRepository,
    inject: [DATABASE_CLIENT],
    useFactory: (db: DatabaseClient) => new AiReviewChunksRepository(db),
  },
  {
    provide: ReviewMetricsRepository,
    inject: [DATABASE_CLIENT],
    useFactory: (db: DatabaseClient) => new ReviewMetricsRepository(db),
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
