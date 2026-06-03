import { Module, OnApplicationShutdown } from '@nestjs/common';
import {
  AiReviewChunksRepository,
  AuditLogsRepository,
  AuthSessionsRepository,
  OrganizationsRepository,
  createDatabaseRuntime,
  GithubInstallationsRepository,
  OauthStatesRepository,
  PullRequestsRepository,
  RepositoriesRepository,
  ReviewCommentsRepository,
  ReviewJobsRepository,
  ReviewMetricsRepository,
  UsageRecordsRepository,
  UsersRepository,
  type DatabaseConnection,
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

let databaseConnection: DatabaseConnection | undefined;

@Module({
  providers: [
    {
      provide: DATABASE_CLIENT,
      useFactory: () => {
        databaseConnection ??= createDatabaseRuntime();
        return databaseConnection.client;
      },
    },
    {
      provide: 'DATABASE_LIFECYCLE',
      useClass: class DatabaseLifecycle implements OnApplicationShutdown {
        async onApplicationShutdown(): Promise<void> {
          try {
            await databaseConnection?.pool.end();
            databaseConnection = undefined;
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
