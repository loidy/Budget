'use client';

import { FormEvent, useEffect, useRef, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Check, Copy, Link2, Loader2, Search, Settings2, Share2, Trash2, X } from 'lucide-react';
import { getOrCreateHouseInviteToken } from '../actions/houses';
import { searchSharableUsers, type ListedUser } from '../actions/users';
import { DEFAULT_HOUSE_ICON, isHouseIconId } from '../lib/houseIcons';
import { isInvitePlaceholderEmail } from '../lib/invites';
import type { House } from '../types';
import { HouseIconPicker } from './HouseIconPicker';
import { ModalPortal } from './ModalPortal';

interface HouseSettingsModalProps {
  house: House;
  onClose: () => void;
  onUpdate: (name: string, description: string, icon: string) => void;
  onDelete: () => void;
  onShare: (email: string) => void;
  onUnshare: (userId: string) => void;
}

export function HouseSettingsModal({
  house,
  onClose,
  onUpdate,
  onDelete,
  onShare,
  onUnshare,
}: HouseSettingsModalProps) {
  const t = useTranslations('houses');
  const tc = useTranslations('common');
  const te = useTranslations('errors');
  const isOwner = house.role === 'owner';
  const [name, setName] = useState(house.name);
  const [description, setDescription] = useState(house.description || '');
  const [icon, setIcon] = useState(
    isHouseIconId(house.icon) ? house.icon : DEFAULT_HOUSE_ICON
  );
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<ListedUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [isWorking, startTransition] = useTransition();
  const searchBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOwner) return;

    startTransition(async () => {
      try {
        const token = await getOrCreateHouseInviteToken(house.id);
        setInviteUrl(`${window.location.origin}/invite/${token}`);
      } catch (cause) {
        setShareError(cause instanceof Error ? cause.message : te('invitePrepareFailed'));
      }
    });
  }, [house.id, isOwner]);

  useEffect(() => {
    if (!isOwner) return;

    const needle = query.trim();
    if (needle.length < 2) {
      setMatches([]);
      setSearching(false);
      return;
    }

    const handle = window.setTimeout(async () => {
      setSearching(true);
      try {
        setMatches(await searchSharableUsers(house.id, needle));
      } catch (cause) {
        setShareError(cause instanceof Error ? cause.message : te('searchFailed'));
        setMatches([]);
      } finally {
        setSearching(false);
      }
    }, 250);

    return () => window.clearTimeout(handle);
  }, [house.id, isOwner, query]);

  useEffect(() => {
    const handlePointer = (event: MouseEvent) => {
      if (!searchBoxRef.current?.contains(event.target as Node)) {
        setMatches([]);
      }
    };

    document.addEventListener('mousedown', handlePointer);
    return () => document.removeEventListener('mousedown', handlePointer);
  }, []);

  const handleSave = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    onUpdate(name.trim(), description.trim(), icon);
  };

  const handleShare = (event: FormEvent) => {
    event.preventDefault();
    const email = query.trim();
    if (!email.includes('@')) {
      setShareError(t('pickUserOrEmail'));
      return;
    }
    setShareError(null);
    onShare(email);
    setQuery('');
    setMatches([]);
  };

  const handleSelectUser = (user: ListedUser) => {
    setShareError(null);
    onShare(user.email);
    setQuery('');
    setMatches([]);
  };

  const copyInvite = async () => {
    if (!inviteUrl) return;
    setShareError(null);

    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setShareError(t('copyFailedManual'));
    }
  };

  const handleDelete = () => {
    if (confirm(t('confirmDeleteHouse', { name: house.name }))) {
      onDelete();
      onClose();
    }
  };

  return (
    <ModalPortal>
    <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 text-white rounded-2xl max-w-lg w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="text-base font-semibold flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-blue-400" />
              {t('settingsTitle', { name: house.name })}
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              {t('settingsLead')}
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

        <form onSubmit={handleSave} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              {t('houseNameRequired')}
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full text-sm bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">{tc('description')}</label>
            <input
              type="text"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="w-full text-sm bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <HouseIconPicker value={icon} onChange={setIcon} />

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg shadow-sm"
            >
              {t('saveChanges')}
            </button>
          </div>
        </form>

        {isOwner && (
          <div className="mt-5 pt-5 border-t border-slate-800">
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <Share2 className="w-3.5 h-3.5 text-blue-400" />
              {t('sharing')}
            </h4>
            <p className="text-xs text-slate-400 mb-3">
              {t('sharingLead')}
            </p>

            <div className="mb-3">
              <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1.5">
                <Link2 className="w-3.5 h-3.5 text-blue-400" />
                {t('inviteLink')}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={inviteUrl ?? ''}
                  placeholder={isWorking ? t('preparingLink') : ''}
                  className="flex-1 text-xs bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={copyInvite}
                  disabled={!inviteUrl}
                  className="px-3 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white rounded-lg shrink-0 flex items-center gap-1.5"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? tc('copied') : tc('copy')}
                </button>
              </div>
              <p className="text-[11px] text-slate-500 mt-1.5">
                {t('inviteLinkHelp')}
              </p>
            </div>

            <form onSubmit={handleShare} className="mb-3">
              <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-blue-400" />
                {t('existingUser')}
              </label>
              <div ref={searchBoxRef} className="relative flex gap-2">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    placeholder={t('searchPlaceholder')}
                    value={query}
                    onChange={(event) => {
                      setShareError(null);
                      setQuery(event.target.value);
                    }}
                    className="w-full text-sm bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                  {(searching || matches.length > 0) && (
                    <ul className="absolute z-10 left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-lg border border-slate-700 bg-slate-800 shadow-xl">
                      {searching && matches.length === 0 && (
                        <li className="px-3 py-2 text-xs text-slate-400 flex items-center gap-2">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          {t('searching')}
                        </li>
                      )}
                      {matches.map((user) => (
                        <li key={user.id}>
                          <button
                            type="button"
                            onClick={() => handleSelectUser(user)}
                            className="w-full text-left px-3 py-2 hover:bg-slate-700/80"
                          >
                            <p className="text-sm font-medium truncate">{user.name}</p>
                            <p className="text-[11px] text-slate-400 truncate">{user.email}</p>
                          </button>
                        </li>
                      ))}
                      {!searching && query.trim().length >= 2 && matches.length === 0 && (
                        <li className="px-3 py-2 text-xs text-slate-500">
                          {t('noMatches')}
                        </li>
                      )}
                    </ul>
                  )}
                </div>
                <button
                  type="submit"
                  className="px-3 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg shrink-0"
                >
                  {tc('add')}
                </button>
              </div>
            </form>

            {shareError && <p className="text-xs font-semibold text-rose-400 mb-3">{shareError}</p>}

            <ul className="space-y-2">
              {house.members.map((member) => (
                <li
                  key={member.userId}
                  className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-slate-800/80 border border-slate-800"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{member.name}</p>
                    <p className="text-[11px] text-slate-400 truncate">
                      {isInvitePlaceholderEmail(member.email)
                        ? t('pendingAccountSetup')
                        : member.email}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onUnshare(member.userId)}
                    className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg"
                    title={t('removeAccess')}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
              {house.members.length === 0 && (
                <li className="text-xs text-slate-500">{t('notSharedYet')}</li>
              )}
            </ul>
          </div>
        )}

        {isOwner && (
          <div className="mt-5 pt-5 border-t border-slate-800">
            <button
              type="button"
              onClick={handleDelete}
              className="w-full flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-rose-300 bg-rose-950/40 hover:bg-rose-950/70 border border-rose-800/50 rounded-lg transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {t('deleteHouse')}
            </button>
          </div>
        )}
      </div>
    </div>
    </ModalPortal>
  );
}
