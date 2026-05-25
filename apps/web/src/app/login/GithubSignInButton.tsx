'use client';

import { signIn } from 'next-auth/react';

export function GithubSignInButton(): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={() => void signIn('github')}
      className="rounded-full bg-[color:var(--app-accent)] px-5 py-3 text-center text-sm font-semibold text-white transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)]"
    >
      Continue with GitHub
    </button>
  );
}