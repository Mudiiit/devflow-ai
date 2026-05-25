import type { NextAuthOptions } from 'next-auth';
import GitHub from 'next-auth/providers/github';

const githubClientId = process.env.GITHUB_CLIENT_ID;
const githubClientSecret = process.env.GITHUB_CLIENT_SECRET;

const providers = githubClientId && githubClientSecret
  ? [
      GitHub({
        clientId: githubClientId,
        clientSecret: githubClientSecret,
      }),
    ]
  : [];

if (providers.length === 0) {
  console.warn('[web] NextAuth GitHub provider is disabled because GITHUB_CLIENT_ID/GITHUB_CLIENT_SECRET are missing');
}

export const authOptions: NextAuthOptions = {
  providers,
  session: {
    strategy: 'jwt',
  },
};