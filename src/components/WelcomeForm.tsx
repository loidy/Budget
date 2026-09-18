'use client';

import { FormEvent, useState } from 'react';
import { Loader2, LineChart } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { completeInvitedAccount } from '../actions/account';
import { INVITE_PLACEHOLDER_NAME } from '../lib/invites';
import { LanguageSwitcher } from './LanguageSwitcher';

interface WelcomeFormProps {
  defaultName: string;
}

export function WelcomeForm({ defaultName }: WelcomeFormProps) {
  const t = useTranslations('auth');
  const tc = useTranslations('common');
  const te = useTranslations('errors');
  const [name, setName] = useState(defaultName === INVITE_PLACEHOLDER_NAME ? '' : defaultName);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError(t('passwordsMismatch'));
      return;
    }

    setPending(true);
    try {
      await completeInvitedAccount({
        name: name.trim(),
        email: email.trim(),
        password,
      });
      window.location.href = '/';
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : te('accountSetupFailed'));
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

        <h1 className="text-lg font-bold text-slate-900 text-center">{t('welcomeTitle')}</h1>
        <p className="text-sm text-slate-500 mt-2 text-center">{t('welcomeLead')}</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-3">
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
            <label className="block text-xs font-medium text-slate-600 mb-1">{tc('newPassword')}</label>
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              {tc('confirmPassword')}
            </label>
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={pending}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold transition-colors"
          >
            {pending && <Loader2 className="w-4 h-4 animate-spin" />}
            {t('saveAndContinue')}
          </button>
        </form>

        {error && <p className="mt-4 text-xs font-semibold text-rose-700">{error}</p>}
      </div>
    </main>
  );
}
