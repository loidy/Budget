'use client';

import { FormEvent, useEffect, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Check, Copy, Link2, Loader2, UserPlus, Users, X } from 'lucide-react';
import {
  createUserInvite,
  listPendingUserInvites,
  listUsers,
  type ListedUser,
  type PendingUserInvite,
} from '../actions/users';
import { ModalPortal } from './ModalPortal';

interface UsersManagerProps {
  open: boolean;
  onClose: () => void;
}

function inviteUrlFor(token: string): string {
  return `${window.location.origin}/invite/account/${token}`;
}

export function UsersManager({ open, onClose }: UsersManagerProps) {
  const t = useTranslations('users');
  const tc = useTranslations('common');
  const te = useTranslations('errors');
  const [users, setUsers] = useState<ListedUser[]>([]);
  const [pending, setPending] = useState<PendingUserInvite[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, startTransition] = useTransition();

  const refresh = () => {
    startTransition(async () => {
      try {
        const [nextUsers, nextPending] = await Promise.all([listUsers(), listPendingUserInvites()]);
        setUsers(nextUsers);
        setPending(nextPending);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : te('loadUsersFailed'));
      }
    });
  };

  useEffect(() => {
    if (open) {
      setError(null);
      setInviteUrl(null);
      setCopiedToken(null);
      refresh();
    }
  }, [open]);

  if (!open) return null;

  const copyUrl = async (url: string, token: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedToken(token);
      window.setTimeout(() => setCopiedToken((current) => (current === token ? null : current)), 1500);
    } catch {
      setError(te('clipboardFailed'));
    }
  };

  const handleCreate = (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        const invite = await createUserInvite({ name: name.trim(), email: email.trim() });
        const url = inviteUrlFor(invite.token);
        setName('');
        setEmail('');
        setInviteUrl(url);
        setPending(await listPendingUserInvites());
        setUsers(await listUsers());
        await copyUrl(url, invite.token);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : te('inviteCreateFailed'));
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
              <Users className="w-4 h-4 text-blue-400" />
              {t('title')}
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              {t('lead')}
            </p>
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

        <form onSubmit={handleCreate} className="space-y-3 mb-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">{tc('name')}</label>
              <input
                type="text"
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="w-full text-sm bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">{tc('email')}</label>
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full text-sm bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white rounded-lg"
          >
            {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
            {t('createInviteLink')}
          </button>
        </form>

        {inviteUrl && (
          <div className="mb-5">
            <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1.5">
              <Link2 className="w-3.5 h-3.5 text-blue-400" />
              {t('inviteLink')}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={inviteUrl}
                className="flex-1 text-xs bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  const token = pending.find((invite) => inviteUrlFor(invite.token) === inviteUrl)?.token;
                  if (token) void copyUrl(inviteUrl, token);
                }}
                className="px-3 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg shrink-0 flex items-center gap-1.5"
              >
                {copiedToken && inviteUrl.endsWith(copiedToken) ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                {copiedToken && inviteUrl.endsWith(copiedToken) ? tc('copied') : tc('copy')}
              </button>
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5">
              {t('inviteLinkHelp')}
            </p>
          </div>
        )}

        {error && <p className="text-xs font-semibold text-rose-400 mb-3">{error}</p>}

        {pending.length > 0 && (
          <div className="mb-5">
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              {t('pendingInvites')}
            </h4>
            <ul className="space-y-2">
              {pending.map((invite) => {
                const url = inviteUrlFor(invite.token);
                const copied = copiedToken === invite.token;
                return (
                  <li
                    key={invite.id}
                    className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-slate-800/80 border border-slate-800"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{invite.name}</p>
                      <p className="text-[11px] text-slate-400 truncate">{invite.email}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setInviteUrl(url);
                        void copyUrl(url, invite.token);
                      }}
                      className="px-2.5 py-1.5 text-[11px] font-semibold bg-slate-700 hover:bg-slate-600 text-white rounded-lg shrink-0 flex items-center gap-1.5"
                    >
                      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {copied ? tc('copied') : tc('copy')}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
          {t('existingUsers')}
        </h4>
        <ul className="space-y-2">
          {users.map((user) => (
            <li
              key={user.id}
              className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-slate-800/80 border border-slate-800"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{user.name}</p>
                <p className="text-[11px] text-slate-400 truncate">{user.email}</p>
              </div>
            </li>
          ))}
          {users.length === 0 && !isLoading && (
            <li className="text-xs text-slate-500">{t('noUsers')}</li>
          )}
        </ul>
      </div>
    </div>
    </ModalPortal>
  );
}
