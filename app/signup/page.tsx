'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Loader2, UserPlus, AlertCircle, CheckCircle2 } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import GoogleAuthButton from '@/components/auth/google-auth-button';

export default function SignupPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setIsSubmitting(true);
    const supabase = createSupabaseBrowserClient();

    // The `name` passed in options.data.name is read by the
    // handle_new_auth_user() trigger (supabase/migrations/0005_auth_user_sync.sql)
    // to populate public.users.name on signup.
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });

    if (signUpError) {
      setError(signUpError.message);
      setIsSubmitting(false);
      return;
    }

    // If email confirmation is enabled on the Supabase project, there's no
    // session yet — show a "check your inbox" state instead of redirecting.
    if (data.session) {
      window.location.href = '/';
      return;
    }

    setSubmitted(true);
    setIsSubmitting(false);
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-neutral-950 flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <CheckCircle2 size={40} className="mx-auto text-emerald-400 mb-4" />
          <h1 className="text-xl font-semibold text-slate-800 dark:text-neutral-100 mb-2">Check your email</h1>
          <p className="text-sm text-slate-500 dark:text-neutral-500">
            We sent a confirmation link to <span className="text-slate-600 dark:text-neutral-300">{email}</span>. Click it to activate
            your account, then sign in.
          </p>
          <Link href="/login" className="inline-block mt-6 text-sm text-blue-400 hover:text-blue-300 font-medium">
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-neutral-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-slate-800 dark:text-neutral-100">Syncora</h1>
          <p className="text-sm text-slate-500 dark:text-neutral-500 mt-1">Create your account</p>
        </div>

        <div className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-xl p-6 shadow-2xl space-y-4">
          <GoogleAuthButton />

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
            <label htmlFor="name" className="block text-xs font-medium text-slate-500 dark:text-neutral-400 mb-1.5">
              Full name
            </label>
            <input
              id="name"
              type="text"
              required
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-50 dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-neutral-100 placeholder:text-slate-600 dark:placeholder:text-neutral-300 focus:outline-none focus:ring-2 focus:ring-blue-600/50 focus:border-blue-600/50"
              placeholder="Jane Doe"
            />
          </div>

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
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-50 dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-neutral-100 placeholder:text-slate-600 dark:placeholder:text-neutral-300 focus:outline-none focus:ring-2 focus:ring-blue-600/50 focus:border-blue-600/50"
              placeholder="At least 8 characters"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg px-4 py-2.5 transition-colors"
          >
            {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
            {isSubmitting ? 'Creating account…' : 'Create account'}
          </button>
        </form>
        </div>

        <p className="text-center text-sm text-slate-500 dark:text-neutral-500 mt-5">
          Already have an account?{' '}
          <Link href="/login" className="text-blue-400 hover:text-blue-300 font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
