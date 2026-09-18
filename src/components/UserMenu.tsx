'use client';

import { useEffect, useState } from 'react';
import { LogOut, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { authClient } from '../lib/auth-client';
import type { SessionUser } from '../types';
import { AccountSettings } from './AccountSettings';
import { LanguageSwitcher } from './LanguageSwitcher';
import { UsersManager } from './UsersManager';

interface UserMenuProps {
  user: SessionUser;
  layout?: 'bar' | 'menu';
}

const headerIconClass =
  'p-1.5 rounded-lg bg-slate-800 text-slate-300 transition-all duration-150 hover:bg-slate-600 hover:text-white hover:scale-110 hover:shadow-md hover:shadow-black/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 active:scale-95';

const headerNameClass =
  'text-xs text-slate-300 max-w-[180px] truncate px-2 py-1 rounded-lg transition-all duration-150 hover:bg-slate-600 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900';

const menuIconClass =
  'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-600 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400';

export function UserMenu({ user, layout = 'bar' }: UserMenuProps) {
  const t = useTranslations('auth');
  const tu = useTranslations('users');
  const [usersOpen, setUsersOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [displayName, setDisplayName] = useState(user.name);

  useEffect(() => {
    setDisplayName(user.name);
  }, [user.name]);

  const signOut = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          window.location.href = '/login';
        },
      },
    });
  };

  return (
    <>
      {layout === 'menu' ? (
        <div className="flex w-full items-center gap-2">
          <LanguageSwitcher variant="dark" />
          <button
            type="button"
            onClick={() => setAccountOpen(true)}
            className="flex min-h-11 min-w-0 flex-1 items-center rounded-lg px-3 text-left text-sm font-medium text-slate-200 hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            title={t('myAccount')}
          >
            <span className="truncate">{displayName || user.email}</span>
          </button>
          <button
            type="button"
            onClick={() => setUsersOpen(true)}
            className={menuIconClass}
            title={tu('title')}
          >
            <Users className="h-4 w-4" />
          </button>
          <button type="button" onClick={signOut} className={menuIconClass} title={t('signOut')}>
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      ) : (
      <div className="flex items-center gap-2 shrink-0">
        <LanguageSwitcher variant="dark" />
        <button
          type="button"
          onClick={() => setAccountOpen(true)}
          className={headerNameClass}
          title={t('myAccount')}
        >
          {displayName || user.email}
        </button>
        <button
          type="button"
          onClick={() => setUsersOpen(true)}
          className={headerIconClass}
          title={tu('title')}
        >
          <Users className="w-3.5 h-3.5" />
        </button>
        <button type="button" onClick={signOut} className={headerIconClass} title={t('signOut')}>
          <LogOut className="w-3.5 h-3.5" />
        </button>
      </div>
      )}

      <AccountSettings
        user={{ ...user, name: displayName }}
        open={accountOpen}
        onClose={() => setAccountOpen(false)}
        onNameSaved={setDisplayName}
      />
      <UsersManager open={usersOpen} onClose={() => setUsersOpen(false)} />
    </>
  );
}
