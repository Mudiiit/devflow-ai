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
  if (process.env.NODE_ENV !== 'production') {
    console.warn('[web] NextAuth GitHub provider is disabled because GITHUB_CLIENT_ID/GITHUB_CLIENT_SECRET are missing');
  }
}

if (!nextAuthSecret) {
  if (process.env.NODE_ENV !== 'production') {
    console.warn('[web] NEXTAUTH_SECRET is not set; session tokens may not be stable across restarts/deploys');
  }
}

if (!nextAuthUrl) {
  if (process.env.NODE_ENV !== 'production') {
    console.warn('[web] NEXTAUTH_URL is not set; callback/cookie behavior may be inconsistent outside Vercel managed host detection');
  }
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
    async signIn() {
      return true;
    },
    async jwt({ token, user }) {
      if (user?.id) {
        token.sub = user.id;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        (session.user as { id?: string }).id = token.sub;
      }

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

      return destination;
    },
  },
};