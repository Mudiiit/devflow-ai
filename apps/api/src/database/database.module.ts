import { Module } from '@nestjs/common';
import { createDatabaseClient, type DatabaseClient } from '@devflow/database';
import {
  AuditLogsRepository,
  BillingCustomersRepository,
  AuthSessionsRepository,
  GithubInstallationsRepository,
  OrganizationMembershipsRepository,
  OrganizationSettingsRepository,
  OrganizationsRepository,
  OauthStatesRepository,
  PricingPlansRepository,
  NotificationsRepository,
  PullRequestsRepository,
  RepositoriesRepository,
  RepositorySettingsRepository,
  SubscriptionsRepository,
  ReviewCommentsRepository,
  ReviewJobsRepository,
  ReviewMetricsRepository,
  InvoicesRepository,
  UsageRecordsRepository,
  UsersRepository,
} from '@devflow/database';
import { DATABASE_CLIENT } from './database.constants.js';

const repositoryProviders = [
  {
    provide: AuditLogsRepository,
    inject: [DATABASE_CLIENT],
    useFactory: (db: DatabaseClient) => new AuditLogsRepository(db),
  },
  {
    provide: BillingCustomersRepository,
    inject: [DATABASE_CLIENT],
    useFactory: (db: DatabaseClient) => new BillingCustomersRepository(db),
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
    provide: OrganizationMembershipsRepository,
    inject: [DATABASE_CLIENT],
    useFactory: (db: DatabaseClient) => new OrganizationMembershipsRepository(db),
  },
  {
    provide: OrganizationSettingsRepository,
    inject: [DATABASE_CLIENT],
    useFactory: (db: DatabaseClient) => new OrganizationSettingsRepository(db),
  },
  {
    provide: RepositoriesRepository,
    inject: [DATABASE_CLIENT],
    useFactory: (db: DatabaseClient) => new RepositoriesRepository(db),
  },
  {
    provide: RepositorySettingsRepository,
    inject: [DATABASE_CLIENT],
    useFactory: (db: DatabaseClient) => new RepositorySettingsRepository(db),
  },
  {
    provide: PullRequestsRepository,
    inject: [DATABASE_CLIENT],
    useFactory: (db: DatabaseClient) => new PullRequestsRepository(db),
  },
  {
    provide: NotificationsRepository,
    inject: [DATABASE_CLIENT],
    useFactory: (db: DatabaseClient) => new NotificationsRepository(db),
  },
  {
    provide: PricingPlansRepository,
    inject: [DATABASE_CLIENT],
    useFactory: (db: DatabaseClient) => new PricingPlansRepository(db),
  },
  {
    provide: SubscriptionsRepository,
    inject: [DATABASE_CLIENT],
    useFactory: (db: DatabaseClient) => new SubscriptionsRepository(db),
  },
  {
    provide: InvoicesRepository,
    inject: [DATABASE_CLIENT],
    useFactory: (db: DatabaseClient) => new InvoicesRepository(db),
  },
  {
    provide: UsageRecordsRepository,
    inject: [DATABASE_CLIENT],
    useFactory: (db: DatabaseClient) => new UsageRecordsRepository(db),
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