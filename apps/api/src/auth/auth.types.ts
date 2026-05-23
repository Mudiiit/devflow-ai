import type { AuthSession, User } from '@devflow/database';

export interface AuthenticatedUser {
  id: string;
  email: string;
  githubUserId: number;
  githubLogin: string;
  displayName: string | null;
  fullName: string | null;
  avatarUrl: string | null;
  role: User['role'];
  status: User['status'];
}

export interface RequestSessionContext {
  session: AuthSession;
  user: AuthenticatedUser;
}

export interface JwtAccessTokenPayload {
  sub: string;
  sid: string;
  role: User['role'];
  email: string;
  githubLogin: string;
  iat: number;
  exp: number;
  iss: string;
  aud: string;
}

export interface GitHubOAuthProfile {
  githubUserId: number;
  login: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
  githubNodeId: string;
  company: string | null;
  bio: string | null;
}

export interface GitHubInstallationPayload {
  action?: string;
  installation: {
    id: number;
    account: {
      id: number;
      login: string;
      type: 'User' | 'Organization';
    };
    target_type?: 'User' | 'Organization';
    repository_selection?: 'all' | 'selected';
    suspended_at?: string | null;
  };
  repositories?: Array<{
    id: number;
    name: string;
    full_name: string;
    default_branch: string;
    private: boolean;
    archived: boolean;
    fork: boolean;
    language: string | null;
    visibility?: 'public' | 'private' | 'internal';
  }>;
  repositories_added?: Array<{
    id: number;
    name: string;
    full_name: string;
    default_branch: string;
    private: boolean;
    archived: boolean;
    fork: boolean;
    language: string | null;
    visibility?: 'public' | 'private' | 'internal';
  }>;
  repositories_removed?: Array<{
    id: number;
    name: string;
    full_name: string;
  }>;
}