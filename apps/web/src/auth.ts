import type { NextAuthOptions } from 'next-auth';
import GitHub from 'next-auth/providers/github';

const githubClientId = process.env.GITHUB_CLIENT_ID;
const githubClientSecret = process.env.GITHUB_CLIENT_SECRET;
const nextAuthSecret = process.env.NEXTAUTH_SECRET;
const nextAuthUrl = process.env.NEXTAUTH_URL;

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

if (!nextAuthSecret) {
  console.warn('[web] NEXTAUTH_SECRET is not set; session tokens may not be stable across restarts/deploys');
}

if (!nextAuthUrl) {
  console.warn('[web] NEXTAUTH_URL is not set; callback/cookie behavior may be inconsistent outside Vercel managed host detection');
}

export const authOptions: NextAuthOptions = {
  providers,
  secret: nextAuthSecret,
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      const githubLogin =
        profile && typeof profile === 'object' && 'login' in profile
          ? String((profile as { login?: string }).login ?? '')
          : null;

      console.info('[web][nextauth][signIn] user=%s provider=%s githubLogin=%s', user?.email ?? user?.name ?? 'unknown', account?.provider ?? 'unknown', githubLogin ?? 'unknown');
      return true;
    },
    async jwt({ token, user, account, trigger }) {
      if (user?.id) {
        token.sub = user.id;
      }

      console.info('[web][nextauth][jwt] trigger=%s provider=%s sub=%s hasToken=%s', trigger ?? 'unknown', account?.provider ?? 'none', token.sub ?? 'none', Boolean(token));
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        (session.user as { id?: string }).id = token.sub;
      }

      console.info('[web][nextauth][session] user=%s sub=%s expires=%s', session.user?.email ?? session.user?.name ?? 'unknown', token.sub ?? 'none', session.expires ?? 'none');
      return session;
    },
    async redirect({ url, baseUrl }) {
      let destination = baseUrl;

      if (url.startsWith('/')) {
        destination = `${baseUrl}${url}`;
      } else {
        try {
          const parsed = new URL(url);
          if (parsed.origin === baseUrl) {
            destination = url;
          }
        } catch {
          destination = baseUrl;
        }
      }

      if (destination === `${baseUrl}/login` || destination.startsWith(`${baseUrl}/login?`) || destination === baseUrl || destination === `${baseUrl}/`) {
        destination = `${baseUrl}/dashboard`;
      }

      console.info('[web][nextauth][redirect] url=%s baseUrl=%s destination=%s', url, baseUrl, destination);
      return destination;
    },
  },
};