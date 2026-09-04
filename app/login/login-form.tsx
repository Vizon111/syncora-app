'use client';

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Loader2, LogIn, AlertCircle } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import GoogleAuthButton from '@/components/auth/google-auth-button';

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirectTo') || '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const supabase = createSupabaseBrowserClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setError(signInError.message);
      setIsSubmitting(false);
      return;
    }

    router.push(redirectTo);
    router.refresh();
  };

  return (
    <div className="w-full max-w-sm">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-semibold text-slate-800 dark:text-neutral-100">Syncora</h1>
        <p className="text-sm text-slate-500 dark:text-neutral-500 mt-1">Sign in to your workspace</p>
      </div>

      <div className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-xl p-6 shadow-2xl space-y-4">
        <GoogleAuthButton redirectTo={redirectTo} />

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-200 dark:bg-neutral-800" />
          <span className="text-xs text-slate-400 dark:text-neutral-600">or</span>
          <div className="h-px flex-1 bg-slate-200 dark:bg-neutral-800" />
        </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="flex items-start gap-2 bg-red-950/40 border border-red-900/50 rounded-lg px-3 py-2.5 text-sm text-red-300">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div>
          <label htmlFor="email" className="block text-xs font-medium text-slate-500 dark:text-neutral-400 mb-1.5">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-slate-50 dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-neutral-100 placeholder:text-slate-600 dark:placeholder:text-neutral-300 focus:outline-none focus:ring-2 focus:ring-blue-600/50 focus:border-blue-600/50"
            placeholder="you@company.com"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-xs font-medium text-slate-500 dark:text-neutral-400 mb-1.5">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-slate-50 dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-neutral-100 placeholder:text-slate-600 dark:placeholder:text-neutral-300 focus:outline-none focus:ring-2 focus:ring-blue-600/50 focus:border-blue-600/50"
            placeholder="••••••••"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg px-4 py-2.5 transition-colors"
        >
          {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      </div>

      <p className="text-center text-sm text-slate-500 dark:text-neutral-500 mt-5">
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="text-blue-400 hover:text-blue-300 font-medium">
          Sign up
        </Link>
      </p>
    </div>
  );
}
