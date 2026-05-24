import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { RepositoriesRepository } from '@devflow/database';
import { hasPermission, type AppPermission, type AppRole } from '../../auth/rbac.types.js';

interface OrganizationContext {
  organization: { id: string };
  membership: { role: AppRole; status: string };
}

@Injectable()
export class RepositoryAccessGuard implements CanActivate {
  constructor(private readonly repositoriesRepository: RepositoriesRepository) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & {
      orgContext?: OrganizationContext;
      repositoryContext?: unknown;
      body?: Record<string, unknown>;
      query: Record<string, string | undefined>;
      params: Record<string, string | undefined>;
    }>();

    const org = request.orgContext;
    if (!org || org.membership.status !== 'active') {
      return false;
    }

    const repositoryId = this.readRepositoryId(request);
    if (!repositoryId) {
      return false;
    }

    const repository = await this.repositoriesRepository.findById(repositoryId);
    if (!repository || repository.organizationId !== org.organization.id) {
      return false;
    }

    const requiredPermission = this.resolvePermission(request.method);
    if (!hasPermission(org.membership.role, requiredPermission)) {
      return false;
    }

    request.repositoryContext = {
      repository,
      permission: requiredPermission,
    };
    return true;
  }

  private resolvePermission(method: string): AppPermission {
    return ['GET', 'HEAD'].includes(method.toUpperCase()) ? 'repository.read' : 'repository.manage';
  }

  private readRepositoryId(
    request: Request & {
      body?: Record<string, unknown>;
      query: Record<string, string | undefined>;
      params: Record<string, string | undefined>;
    },
  ): string | null {
    const fromParams = request.params.repositoryId;
    if (typeof fromParams === 'string' && fromParams.length > 0) {
      return fromParams;
    }

    const fromQuery = request.query.repositoryId;
    if (typeof fromQuery === 'string' && fromQuery.length > 0) {
      return fromQuery;
    }

    const fromBody = request.body?.repositoryId;
    if (typeof fromBody === 'string' && fromBody.length > 0) {
      return fromBody;
    }

    return null;
  }
}
