'use client';

import { signIn } from 'next-auth/react';

export function GithubSignInButton(): React.JSX.Element {
  function getCallbackUrl(): string {
    const rawCallbackUrl = new URLSearchParams(window.location.search).get('callbackUrl');

    return rawCallbackUrl && rawCallbackUrl.startsWith('/') && rawCallbackUrl !== '/login'
      ? rawCallbackUrl
      : '/dashboard';
  }

  return (
    <button
      type="button"
      onClick={() => void signIn('github', { callbackUrl: getCallbackUrl() })}
      className="rounded-full bg-(--app-accent) px-5 py-3 text-center text-sm font-semibold text-white transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--app-accent)"
    >
      Continue with GitHub
    </button>
  );
}