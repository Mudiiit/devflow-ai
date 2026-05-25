'use client';

import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';

export function GithubSignInButton(): React.JSX.Element {
  const searchParams = useSearchParams();
  const rawCallbackUrl = searchParams.get('callbackUrl');
  const callbackUrl = rawCallbackUrl && rawCallbackUrl.startsWith('/') && rawCallbackUrl !== '/login'
    ? rawCallbackUrl
    : '/dashboard';

  return (
    <button
      type="button"
      onClick={() => void signIn('github', { callbackUrl })}
      className="rounded-full bg-(--app-accent) px-5 py-3 text-center text-sm font-semibold text-white transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--app-accent)"
    >
      Continue with GitHub
    </button>
  );
}