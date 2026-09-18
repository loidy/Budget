'use client';

import { FormEvent, useState, useTransition } from 'react';
import { Database, Loader2, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { createHouse } from '../actions/houses';
import { DEFAULT_HOUSE_ICON } from '../lib/houseIcons';
import { newId } from '../lib/ids';
import type { SessionUser } from '../types';
import { HouseIconPicker } from './HouseIconPicker';
import { UserMenu } from './UserMenu';

interface EmptyStateProps {
  user: SessionUser;
}

/** Shown when the signed-in user has no owned or shared houses yet. */
export function EmptyState({ user }: EmptyStateProps) {
  const t = useTranslations('houses');
  const tc = useTranslations('common');
  const te = useTranslations('errors');
  const [isLoading, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState(DEFAULT_HOUSE_ICON);

  const handleCreateHouse = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    setError(null);

    startTransition(async () => {
      try {
        await createHouse({
          id: newId('house'),
          name: name.trim(),
          description: description.trim(),
          icon,
          defaultAccountId: newId('acc'),
          defaultLabelId: newId('lbl'),
          defaultAccountName: t('defaultAccount'),
          defaultLabelName: t('defaultLabel'),
        });
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : te('houseCreateFailed'));
      }
    });
  };

  return (
    <div className="min-h-screen bg-slate-100/70">
      <div className="bg-slate-900 text-white border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-end">
          <UserMenu user={user} />
        </div>
      </div>

      <main className="flex items-center justify-center px-4 py-16">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl shadow-sm p-8">
          <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center mx-auto mb-4">
            <Database className="w-6 h-6" />
          </div>

          <h1 className="text-lg font-bold text-slate-900 text-center">{t('emptyTitle')}</h1>
          <p className="text-sm text-slate-500 mt-2 text-center">{t('emptyLead')}</p>

          <form onSubmit={handleCreateHouse} className="mt-6 space-y-3">
            <input
              type="text"
              required
              placeholder={t('houseName')}
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-500"
            />
            <input
              type="text"
              placeholder={tc('optionalDescription')}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-500"
            />
            <HouseIconPicker value={icon} onChange={setIcon} variant="light" />
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold transition-colors"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {t('createHouse')}
            </button>
          </form>

          {error && <p className="mt-4 text-xs font-semibold text-rose-700">{error}</p>}
        </div>
      </main>
    </div>
  );
}
