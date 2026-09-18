'use client';

import { FormEvent, useState } from 'react';
import { Loader2, LineChart } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { authClient } from '../lib/auth-client';
import { LanguageSwitcher } from './LanguageSwitcher';

interface AccountInviteFormProps {
  token: string;
  name: string;
  email: string;
  errorCode?: string | null;
  signedInAs?: string | null;
}

export function AccountInviteForm({
  token,
  name: defaultName,
  email,
  errorCode = null,
  signedInAs = null,
}: AccountInviteFormProps) {
  const t = useTranslations('auth');
  const tc = useTranslations('common');
  const [name, setName] = useState(defaultName);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const inviteErrorKey =
    errorCode === 'password' ||
    errorCode === 'name' ||
    errorCode === 'exists' ||
    errorCode === 'signup' ||
    errorCode === 'session'
      ? (`inviteErrors.${errorCode}` as const)
      : null;
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const shownError = error ?? (inviteErrorKey ? t(inviteErrorKey) : null);

  const signOut = async () => {
    setPending(true);
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          window.location.reload();
        },
      },
    });
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    setError(null);

    if (password !== confirmPassword) {
      event.preventDefault();
      setError(t('passwordsMismatch'));
      return;
    }

    setPending(true);
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

        <h1 className="text-lg font-bold text-slate-900 text-center">{t('inviteTitle')}</h1>
        <p className="text-sm text-slate-500 mt-2 text-center">{t('inviteLead')}</p>

        {signedInAs ? (
          <div className="mt-6 space-y-3">
            <p className="text-sm text-slate-600 text-center">
              {t.rich('signedInAs', {
                name: () => <span className="font-semibold">{signedInAs}</span>,
              })}
            </p>
            <button
              type="button"
              onClick={signOut}
              disabled={pending}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold transition-colors"
            >
              {pending && <Loader2 className="w-4 h-4 animate-spin" />}
              {t('signOut')}
            </button>
          </div>
        ) : (
          <form
            action={`/invite/account/${token}/accept`}
            method="post"
            onSubmit={onSubmit}
            className="mt-6 space-y-3"
          >
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{tc('name')}</label>
              <input
                type="text"
                name="name"
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
                readOnly
                value={email}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-500 bg-slate-50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{tc('password')}</label>
              <input
                type="password"
                name="password"
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
                name="confirmPassword"
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
              {t('setPasswordAndContinue')}
            </button>
          </form>
        )}

        {shownError && <p className="mt-4 text-xs font-semibold text-rose-700">{shownError}</p>}
      </div>
    </main>
  );
}
