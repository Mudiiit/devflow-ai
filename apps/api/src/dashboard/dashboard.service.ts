import { Inject, Injectable } from '@nestjs/common';
import {
  and,
  desc,
  eq,
  gte,
  pullRequests,
  repositories,
  reviewComments,
  reviewJobs,
  reviewMetrics,
  sql,
  usageRecords,
  type DatabaseClient,
} from '@devflow/database';
import {
  ReviewJobsRepository,
  type ReviewJobMonitoringSnapshot,
} from '@devflow/database';
import { DATABASE_CLIENT } from '../database/database.constants.js';
import { CacheService } from '../security/services/cache.service.js';

const toDateKey = (value: Date): string => value.toISOString().slice(0, 10);

@Injectable()
export class DashboardService {
  constructor(
    @Inject(DATABASE_CLIENT) private readonly db: DatabaseClient,
    private readonly reviewJobsRepository: ReviewJobsRepository,
    private readonly cacheService: CacheService,
  ) {}

  async getOverview(organizationId: string, window = '14d') {
    const cacheKey = `dashboard:overview:${organizationId}:${window}`;
    const cached =
      await this.cacheService.getJson<
        Awaited<ReturnType<DashboardService['buildOverview']>>
      >(cacheKey);
    if (cached) {
      return cached;
    }

    const result = await this.buildOverview(organizationId, window);
    await this.cacheService.setJson(cacheKey, result, 30);
    return result;
  }

  private async buildOverview(organizationId: string, window = '14d') {
    const windowDays = window === '30d' ? 30 : 14;
    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

    const [repoCountRow] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(repositories)
      .where(eq(repositories.organizationId, organizationId));

    const [openPrCountRow] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(pullRequests)
      .innerJoin(repositories, eq(pullRequests.repositoryId, repositories.id))
      .where(
        and(
          eq(repositories.organizationId, organizationId),
          eq(pullRequests.state, 'open'),
        ),
      );

    const [reviewCountRow] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(reviewMetrics)
      .innerJoin(repositories, eq(reviewMetrics.repositoryId, repositories.id))
      .where(
        and(
          eq(repositories.organizationId, organizationId),
          gte(reviewMetrics.createdAt, since),
        ),
      );

    const [tokenSumRow] = await this.db
      .select({
        total: sql<number>`coalesce(sum(${reviewMetrics.totalTokens}), 0)`,
      })
      .from(reviewMetrics)
      .innerJoin(repositories, eq(reviewMetrics.repositoryId, repositories.id))
      .where(
        and(
          eq(repositories.organizationId, organizationId),
          gte(reviewMetrics.createdAt, since),
        ),
      );

    const reviewStatusRows = await this.db
      .select({ status: reviewJobs.status, count: sql<number>`count(*)` })
      .from(reviewJobs)
      .innerJoin(repositories, eq(reviewJobs.repositoryId, repositories.id))
      .where(eq(repositories.organizationId, organizationId))
      .groupBy(reviewJobs.status);

    const metricsRows = await this.db
      .select({
        publishedAt: reviewMetrics.publishedAt,
        riskScore: reviewMetrics.riskScore,
        confidenceScore: reviewMetrics.confidenceScore,
        severityCounts: reviewMetrics.severityCounts,
      })
      .from(reviewMetrics)
      .innerJoin(repositories, eq(reviewMetrics.repositoryId, repositories.id))
      .where(
        and(
          eq(repositories.organizationId, organizationId),
          gte(reviewMetrics.createdAt, since),
        ),
      )
      .orderBy(desc(reviewMetrics.createdAt))
      .limit(120);

    const trendMap = new Map<
      string,
      { date: string; risk: number; confidence: number; count: number }
    >();
    const severityTotals = { critical: 0, warning: 0, info: 0 };

    for (const row of metricsRows) {
      const dateKey = row.publishedAt ? toDateKey(row.publishedAt) : 'unknown';
      const entry = trendMap.get(dateKey) ?? {
        date: dateKey,
        risk: 0,
        confidence: 0,
        count: 0,
      };
      entry.risk += row.riskScore ?? 0;
      entry.confidence += row.confidenceScore ?? 0;
      entry.count += 1;
      trendMap.set(dateKey, entry);

      if (row.severityCounts && typeof row.severityCounts === 'object') {
        severityTotals.critical += Number(row.severityCounts.critical ?? 0);
        severityTotals.warning += Number(row.severityCounts.warning ?? 0);
        severityTotals.info += Number(row.severityCounts.info ?? 0);
      }
    }

    const riskTrend = [...trendMap.values()]
      .map((entry) => ({
        date: entry.date,
        riskScore: entry.count > 0 ? Math.round(entry.risk / entry.count) : 0,
        confidenceScore:
          entry.count > 0 ? Math.round(entry.confidence / entry.count) : 0,
        count: entry.count,
      }))
      .sort((left, right) => left.date.localeCompare(right.date));

    return {
      repositories: repoCountRow?.count ?? 0,
      openPullRequests: openPrCountRow?.count ?? 0,
      reviews: reviewCountRow?.count ?? 0,
      tokens: tokenSumRow?.total ?? 0,
      reviewQueue: reviewStatusRows,
      severityTotals,
      riskTrend,
    };
  }

  async getRepositoriesOverview(organizationId: string) {
    const repoRows = await this.db
      .select({
        id: repositories.id,
        name: repositories.name,
        fullName: repositories.fullName,
        syncState: repositories.syncState,
        language: repositories.language,
        lastSyncedAt: repositories.lastSyncedAt,
      })
      .from(repositories)
      .where(eq(repositories.organizationId, organizationId));

    const metricsRows = await this.db
      .select({
        repositoryId: reviewMetrics.repositoryId,
        riskScore: reviewMetrics.riskScore,
        confidenceScore: reviewMetrics.confidenceScore,
        publishedAt: reviewMetrics.publishedAt,
      })
      .from(reviewMetrics)
      .innerJoin(repositories, eq(reviewMetrics.repositoryId, repositories.id))
      .where(eq(repositories.organizationId, organizationId));

    const latestMetricByRepo = new Map<string, (typeof metricsRows)[number]>();
    for (const metric of metricsRows) {
      const existing = latestMetricByRepo.get(metric.repositoryId);
      if (
        !existing ||
        (metric.publishedAt &&
          existing.publishedAt &&
          metric.publishedAt > existing.publishedAt)
      ) {
        latestMetricByRepo.set(metric.repositoryId, metric);
      }
    }

    return {
      repositories: repoRows.map((repo) => {
        const metric = latestMetricByRepo.get(repo.id);
        const healthScore = metric ? Math.max(0, 100 - metric.riskScore) : 92;
        return {
          ...repo,
          riskScore: metric?.riskScore ?? 0,
          confidenceScore: metric?.confidenceScore ?? 0,
          healthScore,
        };
      }),
    };
  }

  async getPullRequestsOverview(organizationId: string) {
    const rows = await this.db
      .select({
        id: pullRequests.id,
        number: pullRequests.number,
        title: pullRequests.title,
        state: pullRequests.state,
        reviewState: pullRequests.reviewState,
        headSha: pullRequests.headSha,
        updatedAt: pullRequests.updatedAt,
        repositoryName: repositories.fullName,
      })
      .from(pullRequests)
      .innerJoin(repositories, eq(pullRequests.repositoryId, repositories.id))
      .where(eq(repositories.organizationId, organizationId))
      .orderBy(desc(pullRequests.updatedAt))
      .limit(50);

    return { pullRequests: rows };
  }

  async getReviewHistory(
    organizationId: string,
    options: {
      page: number;
      pageSize: number;
      offset: number;
      status?: string | undefined;
    },
  ) {
    const rows = await this.db
      .select({
        id: reviewJobs.id,
        status: reviewJobs.status,
        createdAt: reviewJobs.createdAt,
        completedAt: reviewJobs.completedAt,
        repositoryName: repositories.fullName,
        pullRequestId: reviewJobs.pullRequestId,
        riskScore: reviewMetrics.riskScore,
        overallSeverity: reviewMetrics.overallSeverity,
      })
      .from(reviewJobs)
      .innerJoin(repositories, eq(reviewJobs.repositoryId, repositories.id))
      .leftJoin(reviewMetrics, eq(reviewMetrics.reviewJobId, reviewJobs.id))
      .where(
        and(
          eq(repositories.organizationId, organizationId),
          options.status
            ? eq(reviewJobs.status, options.status as any)
            : sql`true`,
        ),
      )
      .orderBy(desc(reviewJobs.createdAt))
      .limit(options.pageSize)
      .offset(options.offset);

    const [countRow] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(reviewJobs)
      .innerJoin(repositories, eq(reviewJobs.repositoryId, repositories.id))
      .where(
        and(
          eq(repositories.organizationId, organizationId),
          options.status
            ? eq(reviewJobs.status, options.status as any)
            : sql`true`,
        ),
      );

    return {
      reviews: rows,
      pagination: {
        page: options.page,
        pageSize: options.pageSize,
        total: countRow?.count ?? 0,
      },
    };
  }

  async getJobMonitoring(
    organizationId: string,
    limit = 25,
  ): Promise<ReviewJobMonitoringSnapshot> {
    return this.reviewJobsRepository.findMonitoringSnapshot(
      organizationId,
      limit,
    );
  }

  async getReviewDetail(organizationId: string, reviewJobId: string) {
    const [reviewRow] = await this.db
      .select({
        id: reviewJobs.id,
        status: reviewJobs.status,
        createdAt: reviewJobs.createdAt,
        completedAt: reviewJobs.completedAt,
        repositoryName: repositories.fullName,
        pullRequestId: reviewJobs.pullRequestId,
        output: reviewJobs.output,
        riskScore: reviewMetrics.riskScore,
        confidenceScore: reviewMetrics.confidenceScore,
        overallSeverity: reviewMetrics.overallSeverity,
        severityCounts: reviewMetrics.severityCounts,
        categoryCounts: reviewMetrics.categoryCounts,
        summary: reviewMetrics.summary,
      })
      .from(reviewJobs)
      .innerJoin(repositories, eq(reviewJobs.repositoryId, repositories.id))
      .leftJoin(reviewMetrics, eq(reviewMetrics.reviewJobId, reviewJobs.id))
      .where(
        and(
          eq(repositories.organizationId, organizationId),
          eq(reviewJobs.id, reviewJobId),
        ),
      )
      .limit(1);

    const comments = await this.db
      .select({
        id: reviewComments.id,
        body: reviewComments.body,
        path: reviewComments.path,
        lineNumber: reviewComments.lineNumber,
        metadata: reviewComments.metadata,
        createdAt: reviewComments.createdAt,
      })
      .from(reviewComments)
      .where(eq(reviewComments.reviewJobId, reviewJobId))
      .orderBy(desc(reviewComments.createdAt));

    return { review: reviewRow ?? null, comments };
  }

  async retryReview(
    organizationId: string,
    reviewJobId: string,
    userId: string,
  ) {
    const [reviewRow] = await this.db
      .select({
        repositoryId: reviewJobs.repositoryId,
        pullRequestId: reviewJobs.pullRequestId,
      })
      .from(reviewJobs)
      .innerJoin(repositories, eq(reviewJobs.repositoryId, repositories.id))
      .where(
        and(
          eq(repositories.organizationId, organizationId),
          eq(reviewJobs.id, reviewJobId),
        ),
      )
      .limit(1);

    if (!reviewRow) {
      return { ok: false };
    }

    const rows = await this.db
      .insert(reviewJobs)
      .values({
        repositoryId: reviewRow.repositoryId,
        pullRequestId: reviewRow.pullRequestId,
        requestedByUserId: userId,
        status: 'queued',
        jobType: 'pull_request_review',
        priority: 0,
        input: {
          source: 'dashboard_retry',
          previousReviewJobId: reviewJobId,
        },
        metadata: {
          retriedFrom: reviewJobId,
        },
      })
      .returning();

    return { ok: true, reviewJob: rows[0] ?? null };
  }

  async getAnalytics(organizationId: string) {
    const rows = await this.db
      .select({
        repositoryId: reviewMetrics.repositoryId,
        riskScore: reviewMetrics.riskScore,
        confidenceScore: reviewMetrics.confidenceScore,
        severityCounts: reviewMetrics.severityCounts,
        categoryCounts: reviewMetrics.categoryCounts,
        publishedAt: reviewMetrics.publishedAt,
      })
      .from(reviewMetrics)
      .innerJoin(repositories, eq(reviewMetrics.repositoryId, repositories.id))
      .where(eq(repositories.organizationId, organizationId))
      .orderBy(desc(reviewMetrics.createdAt))
      .limit(200);

    return { metrics: rows };
  }

  async getRecentActivity(organizationId: string) {
    const rows = await this.db
      .select({
        id: reviewJobs.id,
        status: reviewJobs.status,
        createdAt: reviewJobs.createdAt,
        repositoryName: repositories.fullName,
        pullRequestId: reviewJobs.pullRequestId,
      })
      .from(reviewJobs)
      .innerJoin(repositories, eq(reviewJobs.repositoryId, repositories.id))
      .where(eq(repositories.organizationId, organizationId))
      .orderBy(desc(reviewJobs.createdAt))
      .limit(30);

    return { activity: rows };
  }

  async getRepositoryHealth(organizationId: string) {
    const repoRows = await this.db
      .select({
        id: repositories.id,
        fullName: repositories.fullName,
      })
      .from(repositories)
      .where(eq(repositories.organizationId, organizationId));

    const metricsRows = await this.db
      .select({
        repositoryId: reviewMetrics.repositoryId,
        riskScore: reviewMetrics.riskScore,
        publishedAt: reviewMetrics.publishedAt,
      })
      .from(reviewMetrics)
      .innerJoin(repositories, eq(reviewMetrics.repositoryId, repositories.id))
      .where(eq(repositories.organizationId, organizationId));

    const scores = repoRows.map((repo) => {
      const repoMetrics = metricsRows.filter(
        (metric) => metric.repositoryId === repo.id,
      );
      const avgRisk =
        repoMetrics.length > 0
          ? Math.round(
              repoMetrics.reduce(
                (total, metric) => total + metric.riskScore,
                0,
              ) / repoMetrics.length,
            )
          : 0;
      return {
        repositoryId: repo.id,
        repositoryName: repo.fullName,
        riskScore: avgRisk,
        healthScore: Math.max(0, 100 - avgRisk),
      };
    });

    return { health: scores };
  }

  async updateOrgStrictness(organizationId: string, reviewStrictness: number) {
    const strictness = Math.min(100, Math.max(0, reviewStrictness));
    await this.db.execute(sql`
      insert into organization_settings (id, organization_id, review_strictness, created_at, updated_at)
      values (gen_random_uuid(), ${organizationId}, ${strictness}, now(), now())
      on conflict (organization_id)
      do update set review_strictness = ${strictness}, updated_at = now()
    `);

    return { organizationId, reviewStrictness: strictness };
  }

  async getAdminAnalytics(organizationId: string) {
    const providerPerformance = await this.db
      .select({
        provider: reviewMetrics.provider,
        count: sql<number>`count(*)`,
        avgExecutionMs: sql<number>`coalesce(avg(${reviewMetrics.executionMs}), 0)`,
        avgRiskScore: sql<number>`coalesce(avg(${reviewMetrics.riskScore}), 0)`,
      })
      .from(reviewMetrics)
      .innerJoin(repositories, eq(reviewMetrics.repositoryId, repositories.id))
      .where(eq(repositories.organizationId, organizationId))
      .groupBy(reviewMetrics.provider);

    const failoverRows = await this.db
      .select({
        fallbackProvider: sql<string>`coalesce(${reviewJobs.metadata}->>'fallbackProvider', 'none')`,
        count: sql<number>`count(*)`,
      })
      .from(reviewJobs)
      .innerJoin(repositories, eq(reviewJobs.repositoryId, repositories.id))
      .where(eq(repositories.organizationId, organizationId))
      .groupBy(
        sql`coalesce(${reviewJobs.metadata}->>'fallbackProvider', 'none')`,
      );

    const usageRows = await this.db
      .select({
        resource: usageRecords.resource,
        quantity: sql<number>`coalesce(sum(${usageRecords.quantity}), 0)`,
      })
      .from(usageRecords)
      .where(eq(usageRecords.organizationId, organizationId))
      .groupBy(usageRecords.resource);

    const costRows = await this.db
      .select({
        totalCostCents: sql<number>`coalesce(sum((${usageRecords.metadata}->>'costCents')::int), 0)`,
      })
      .from(usageRecords)
      .where(eq(usageRecords.organizationId, organizationId));

    return {
      providerPerformance,
      providerFailover: failoverRows,
      usage: usageRows,
      estimatedCostCents: costRows[0]?.totalCostCents ?? 0,
    };
  }
}
