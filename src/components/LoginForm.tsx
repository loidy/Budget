'use client';

import { FormEvent, useState } from 'react';
import { Loader2, LineChart } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { authClient } from '../lib/auth-client';
import { LanguageSwitcher } from './LanguageSwitcher';

interface LoginFormProps {
  googleEnabled: boolean;
  showInviteError?: boolean;
}

type Mode = 'signin' | 'signup';

export function LoginForm({ googleEnabled, showInviteError = false }: LoginFormProps) {
  const t = useTranslations('auth');
  const te = useTranslations('errors');
  const tc = useTranslations('common');
  const [mode, setMode] = useState<Mode>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const shownError = error ?? (showInviteError ? te('inviteInvalid') : null);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setPending(true);

    try {
      if (mode === 'signup') {
        const { error: signUpError } = await authClient.signUp.email({
          name: name.trim(),
          email: email.trim(),
          password,
          callbackURL: '/',
        });

        if (signUpError) {
          setError(signUpError.message || te('signUpFailed'));
          return;
        }
      } else {
        const { error: signInError } = await authClient.signIn.email({
          email: email.trim(),
          password,
          callbackURL: '/',
        });

        if (signInError) {
          setError(signInError.message || te('signInFailed'));
          return;
        }
      }

      window.location.href = '/';
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : te('generic'));
    } finally {
      setPending(false);
    }
  };

  const signInWithGoogle = async () => {
    setError(null);
    setPending(true);

    try {
      const { error: googleError } = await authClient.signIn.social({
        provider: 'google',
        callbackURL: '/',
      });

      if (googleError) {
        setError(googleError.message || te('googleSignInFailed'));
        setPending(false);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : te('googleSignInFailed'));
      setPending(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-100/70 flex items-center justify-center px-4">
      <div className="relative max-w-md w-full bg-white border border-slate-200 rounded-2xl shadow-sm p-8">
        <div className="absolute top-4 right-4">
          <LanguageSwitcher />
        </div>
        <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center mx-auto mb-4">
          <LineChart className="w-6 h-6" />
        </div>

        <h1 className="text-lg font-bold text-slate-900 text-center">
          {mode === 'signin' ? t('signInTitle') : t('signUpTitle')}
        </h1>
        <p className="text-sm text-slate-500 mt-2 text-center">
          {mode === 'signin' ? t('signInLead') : t('signUpLead')}
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-3">
          {mode === 'signup' && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{tc('name')}</label>
              <input
                type="text"
                required
                autoComplete="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-500"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{tc('email')}</label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{tc('password')}</label>
            <input
              type="password"
              required
              minLength={8}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={pending}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold transition-colors"
          >
            {pending && <Loader2 className="w-4 h-4 animate-spin" />}
            {mode === 'signin' ? t('signIn') : t('signUp')}
          </button>
        </form>

        {googleEnabled && (
          <>
            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-slate-200" />
              <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                {t('or')}
              </span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>

            <button
              type="button"
              onClick={signInWithGoogle}
              disabled={pending}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-60 text-slate-800 text-sm font-semibold transition-colors"
            >
              {t('continueWithGoogle')}
            </button>
          </>
        )}

        {shownError && <p className="mt-4 text-xs font-semibold text-rose-700">{shownError}</p>}

        <p className="mt-6 text-xs text-slate-500 text-center">
          {mode === 'signin' ? t('noAccount') : t('haveAccount')}{' '}
          <button
            type="button"
            onClick={() => {
              setMode(mode === 'signin' ? 'signup' : 'signin');
              setError(null);
            }}
            className="font-semibold text-blue-600 hover:text-blue-700"
          >
            {mode === 'signin' ? t('register') : t('signInLink')}
          </button>
        </p>
      </div>
    </main>
  );
}
