import { Module, OnApplicationShutdown } from '@nestjs/common';
import {
  AiReviewChunksRepository,
  AuditLogsRepository,
  AuthSessionsRepository,
  OrganizationsRepository,
  createDatabaseClient,
  GithubInstallationsRepository,
  OauthStatesRepository,
  PullRequestsRepository,
  RepositoriesRepository,
  ReviewCommentsRepository,
  ReviewJobsRepository,
  ReviewMetricsRepository,
  UsageRecordsRepository,
  UsersRepository,
  type DatabaseClient,
} from '@devflow/database';
import { DATABASE_CLIENT } from './database.constants.js';

const repositoryProviders = [
  {
    provide: AuditLogsRepository,
    inject: [DATABASE_CLIENT],
    useFactory: (db: DatabaseClient) => new AuditLogsRepository(db),
  },
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
    provide: OrganizationsRepository,
    inject: [DATABASE_CLIENT],
    useFactory: (db: DatabaseClient) => new OrganizationsRepository(db),
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
  {
    provide: UsageRecordsRepository,
    inject: [DATABASE_CLIENT],
    useFactory: (db: DatabaseClient) => new UsageRecordsRepository(db),
  },
];

@Module({
  providers: [
    {
      provide: DATABASE_CLIENT,
      useFactory: () => createDatabaseClient(),
    },
    {
      provide: 'DATABASE_LIFECYCLE',
      useClass: class DatabaseLifecycle implements OnApplicationShutdown {
        async onApplicationShutdown(): Promise<void> {
          try {
            // import lazily to avoid circular imports at module resolution time
            const { closeDatabaseConnection } = await Promise.resolve(require('@devflow/database'));
            await closeDatabaseConnection();
          } catch (err) {
            // ignore errors during shutdown
          }
        }
      },
    },
    ...repositoryProviders,
  ],
  exports: [DATABASE_CLIENT, ...repositoryProviders.map((provider) => provider.provide)],
})
export class DatabaseModule {}
