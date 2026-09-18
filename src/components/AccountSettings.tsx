'use client';

import { FormEvent, useEffect, useState, useTransition } from 'react';
import { KeyRound, Loader2, UserRound, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { getCredentialStatus, updateOwnProfile } from '../actions/account';
import type { SessionUser } from '../types';
import { ModalPortal } from './ModalPortal';

interface AccountSettingsProps {
  user: SessionUser;
  open: boolean;
  onClose: () => void;
  onNameSaved?: (name: string) => void;
}

export function AccountSettings({ user, open, onClose, onNameSaved }: AccountSettingsProps) {
  const t = useTranslations('auth');
  const tc = useTranslations('common');
  const te = useTranslations('errors');
  const [name, setName] = useState(user.name);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [hasPassword, setHasPassword] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isLoading, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;

    setName(user.name);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setError(null);
    setSaved(false);

    startTransition(async () => {
      try {
        setHasPassword((await getCredentialStatus()).hasPassword);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : te('loadAccountFailed'));
      }
    });
  }, [open, user.name]);

  if (!open) return null;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSaved(false);

    if (newPassword && hasPassword && !currentPassword) {
      setError(t('needCurrentPassword'));
      return;
    }

    if (newPassword && newPassword !== confirmPassword) {
      setError(t('passwordsDoNotMatch'));
      return;
    }

    startTransition(async () => {
      try {
        const nextName = name.trim();
        await updateOwnProfile({
          name: nextName,
          currentPassword: currentPassword || undefined,
          newPassword: newPassword || undefined,
        });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setSaved(true);
        if (newPassword) setHasPassword(true);
        onNameSaved?.(nextName);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : te('saveAccountFailed'));
      }
    });
  };

  return (
    <ModalPortal>
    <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 text-white rounded-2xl max-w-lg w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="text-base font-semibold flex items-center gap-2">
              <UserRound className="w-4 h-4 text-blue-400" />
              {t('myAccount')}
            </h3>
            <p className="text-xs text-slate-400 mt-1">{user.email}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg"
            title={tc('close')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">{tc('name')}</label>
            <input
              type="text"
              required
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full text-sm bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="pt-2">
            <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-blue-400" />
              {hasPassword ? t('changePassword') : t('setPassword')}
            </p>
            {hasPassword && (
              <div className="mb-3">
                <label className="block text-xs font-medium text-slate-300 mb-1">{tc('currentPassword')}</label>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  className="w-full text-sm bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">{tc('newPassword')}</label>
                <input
                  type="password"
                  minLength={8}
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  className="w-full text-sm bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">{tc('confirmPassword')}</label>
                <input
                  type="password"
                  minLength={8}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="w-full text-sm bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5">
              {hasPassword
                ? t('passwordHintNamed')
                : t('passwordHintGoogle')}
            </p>
          </div>

          {error && <p className="text-xs font-semibold text-rose-400">{error}</p>}
          {saved && !error && <p className="text-xs font-semibold text-emerald-400">{t('changesSaved')}</p>}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white rounded-lg"
          >
            {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {tc('save')}
          </button>
        </form>
      </div>
    </div>
    </ModalPortal>
  );
}
