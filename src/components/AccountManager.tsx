'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ACCOUNT_VISIBILITY, BankAccount, ItemLabel, type AccountVisibility } from '../types';
import {
  Wallet,
  Plus,
  Edit2,
  Trash2,
  Tag,
  EyeOff,
  Info,
  LineChart,
} from 'lucide-react';
import { useBudgetFormat } from '../i18n/useBudgetFormat';

interface AccountManagerProps {
  accounts: BankAccount[];
  labels: ItemLabel[];
  onAddAccount: (account: Omit<BankAccount, 'id'>) => void;
  onUpdateAccount: (account: BankAccount) => void;
  onDeleteAccount: (accountId: string) => void;
  onAddLabel: (name: string, color: string, accountId: string) => void;
  onUpdateLabel: (label: ItemLabel) => void;
  onDeleteLabel: (labelId: string) => void;
}

const ACCOUNT_COLORS = [
  '#2563eb',
  '#059669',
  '#d97706',
  '#7c3aed',
  '#0284c7',
  '#dc2626',
  '#16a34a',
  '#64748b',
  '#e11d48',
];

const LABEL_COLORS = [
  '#8b5cf6',
  '#10b981',
  '#06b6d4',
  '#3b82f6',
  '#f59e0b',
  '#ec4899',
  '#64748b',
  '#e11d48',
  '#84cc16',
];

export const AccountManager: React.FC<AccountManagerProps> = ({
  accounts,
  labels,
  onAddAccount,
  onUpdateAccount,
  onDeleteAccount,
  onAddLabel,
  onUpdateLabel,
  onDeleteLabel,
}) => {
  const t = useTranslations('accounts');
  const tc = useTranslations('common');
  const th = useTranslations('houses');
  const { accountSelectLabel } = useBudgetFormat();
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);
  const [formName, setFormName] = useState('');
  const [formColor, setFormColor] = useState(ACCOUNT_COLORS[0]);
  const [formVisibility, setFormVisibility] = useState<AccountVisibility>(
    ACCOUNT_VISIBILITY.everywhere
  );

  const [isLabelModalOpen, setIsLabelModalOpen] = useState(false);
  const [editingLabel, setEditingLabel] = useState<ItemLabel | null>(null);
  const [labelName, setLabelName] = useState('');
  const [labelColor, setLabelColor] = useState(LABEL_COLORS[0]);
  const [labelAccountId, setLabelAccountId] = useState('');

  const visibilityOptions: Array<{
    value: AccountVisibility;
    title: string;
    description: string;
  }> = [
    {
      value: ACCOUNT_VISIBILITY.everywhere,
      title: t('visibilityEverywhere'),
      description: t('visibilityEverywhereDesc'),
    },
    {
      value: ACCOUNT_VISIBILITY.exceptDashboard,
      title: t('visibilityExceptDashboard'),
      description: t('visibilityExceptDashboardDesc'),
    },
    {
      value: ACCOUNT_VISIBILITY.nowhere,
      title: t('visibilityNowhere'),
      description: t('visibilityNowhereDesc'),
    },
  ];

  const openAddAccount = () => {
    setEditingAccount(null);
    setFormName('');
    setFormColor(ACCOUNT_COLORS[accounts.length % ACCOUNT_COLORS.length]);
    setFormVisibility(ACCOUNT_VISIBILITY.everywhere);
    setIsAccountModalOpen(true);
  };

  const openEditAccount = (acc: BankAccount) => {
    setEditingAccount(acc);
    setFormName(acc.name);
    setFormColor(acc.color || ACCOUNT_COLORS[0]);
    setFormVisibility(acc.visibility);
    setIsAccountModalOpen(true);
  };

  const handleSaveAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    if (editingAccount) {
      onUpdateAccount({
        ...editingAccount,
        name: formName.trim(),
        color: formColor,
        visibility: formVisibility,
      });
    } else {
      onAddAccount({
        name: formName.trim(),
        color: formColor,
        visibility: formVisibility,
      });
    }

    setIsAccountModalOpen(false);
  };

  const openAddLabel = (accountId: string) => {
    setEditingLabel(null);
    setLabelName('');
    setLabelColor(LABEL_COLORS[labels.length % LABEL_COLORS.length]);
    setLabelAccountId(accountId);
    setIsLabelModalOpen(true);
  };

  const openEditLabel = (lbl: ItemLabel) => {
    setEditingLabel(lbl);
    setLabelName(lbl.name);
    setLabelColor(lbl.color);
    setLabelAccountId(lbl.accountId);
    setIsLabelModalOpen(true);
  };

  const handleSaveLabel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!labelName.trim() || !labelAccountId) return;

    if (editingLabel) {
      onUpdateLabel({
        ...editingLabel,
        name: labelName.trim(),
        color: labelColor,
        accountId: labelAccountId,
      });
    } else {
      onAddLabel(labelName.trim(), labelColor, labelAccountId);
    }

    setIsLabelModalOpen(false);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-slate-900">{t('title')}</h3>
            <span className="relative group inline-flex">
              <button
                type="button"
                className="text-slate-400 hover:text-blue-600 transition-colors"
                aria-label={t('infoAria')}
              >
                <Info className="w-4 h-4" />
              </button>
              <span
                role="tooltip"
                className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 w-72 -translate-x-1/2 rounded-lg bg-slate-900 px-3 py-2 text-xs leading-relaxed text-slate-100 opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
              >
                {t('info')}
              </span>
            </span>
          </div>
        </div>

        <button
          onClick={openAddAccount}
          className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg border border-blue-200/60 transition-colors self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{t('addAccount')}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {accounts.map((acc) => {
          const accountLabels = labels.filter((label) => label.accountId === acc.id);

          return (
            <div
              key={acc.id}
              className={`relative group p-4 rounded-xl border bg-slate-50/50 hover:bg-white transition-all shadow-2xs ${
                acc.visibility > ACCOUNT_VISIBILITY.everywhere
                  ? 'border-dashed border-slate-300'
                  : 'border-slate-200/90 hover:border-slate-300'
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0 shadow-2xs"
                    style={{ backgroundColor: acc.color }}
                  >
                    {acc.visibility === ACCOUNT_VISIBILITY.nowhere ? (
                      <EyeOff className="w-4 h-4" />
                    ) : acc.visibility === ACCOUNT_VISIBILITY.exceptDashboard ? (
                      <LineChart className="w-4 h-4" />
                    ) : (
                      <Wallet className="w-4 h-4" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <h4 className="text-sm font-semibold text-slate-900 leading-tight truncate">
                      {acc.name}
                    </h4>
                    {acc.visibility === ACCOUNT_VISIBILITY.exceptDashboard && (
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">
                        {t('visibilityExceptDashboard')}
                      </span>
                    )}
                    {acc.visibility === ACCOUNT_VISIBILITY.nowhere && (
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">
                        {t('visibilityNowhere')}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => openEditAccount(acc)}
                    className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100"
                    title={t('editAccount')}
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  {accounts.length > 1 && (
                    <button
                      onClick={() => {
                        if (confirm(t('confirmDeleteAccount', { name: acc.name }))) {
                          onDeleteAccount(acc.id);
                        }
                      }}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50"
                      title={t('deleteAccount')}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200/60">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    {t('labels')}
                  </span>
                  <button
                    onClick={() => openAddLabel(acc.id)}
                    className="flex items-center gap-1 text-[11px] font-semibold text-purple-700 hover:text-purple-800"
                  >
                    <Plus className="w-3 h-3" />
                    <span>{t('addLabel')}</span>
                  </button>
                </div>

                {accountLabels.length === 0 ? (
                  <p className="text-[11px] text-slate-400">{t('noLabels')}</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {accountLabels.map((lbl) => (
                      <span
                        key={lbl.id}
                        className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full text-[11px] font-medium text-white shadow-2xs"
                        style={{ backgroundColor: lbl.color }}
                      >
                        <Tag className="w-2.5 h-2.5" />
                        <span>{lbl.name}</span>
                        <button
                          onClick={() => openEditLabel(lbl)}
                          className="p-0.5 rounded-full hover:bg-black/15"
                          title={t('editLabel')}
                        >
                          <Edit2 className="w-2.5 h-2.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(t('confirmDeleteLabel', { name: lbl.name }))) {
                              onDeleteLabel(lbl.id);
                            }
                          }}
                          className="p-0.5 rounded-full hover:bg-black/15"
                          title={t('deleteLabel')}
                        >
                          <Trash2 className="w-2.5 h-2.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {isAccountModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white text-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-base font-semibold mb-1 flex items-center gap-2">
              <Wallet className="w-4 h-4 text-blue-600" />
              {editingAccount ? t('editBankAccount') : t('addBankAccount')}
            </h3>
            <p className="text-xs text-slate-500 mb-4">{t('accountModalLead')}</p>

            <form onSubmit={handleSaveAccount} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t('accountNameRequired')}
                </label>
                <input
                  type="text"
                  required
                  placeholder={t('accountNamePlaceholder')}
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full text-sm bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  {t('accountColor')}
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  {ACCOUNT_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setFormColor(c)}
                      className={`w-7 h-7 rounded-full transition-transform ${
                        formColor === c ? 'ring-2 ring-offset-2 ring-slate-900 scale-110' : ''
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <fieldset className="space-y-2">
                <legend className="block text-xs font-semibold text-slate-700 mb-1.5">
                  {t('visibility')}
                </legend>
                {visibilityOptions.map((option) => (
                  <label
                    key={option.value}
                    className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer ${
                      formVisibility === option.value
                        ? 'border-blue-300 bg-blue-50/70'
                        : 'border-slate-200 bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="account-visibility"
                      checked={formVisibility === option.value}
                      onChange={() => setFormVisibility(option.value)}
                      className="mt-0.5 border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>
                      <span className="block text-xs font-semibold text-slate-800">
                        {option.title}
                      </span>
                      <span className="block text-[11px] text-slate-500 mt-0.5">
                        {option.description}
                      </span>
                    </span>
                  </label>
                ))}
              </fieldset>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAccountModalOpen(false)}
                  className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-lg"
                >
                  {tc('cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg shadow-sm"
                >
                  {editingAccount ? th('saveChanges') : t('createAccount')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isLabelModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white text-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-base font-semibold mb-1 flex items-center gap-2">
              <Tag className="w-4 h-4 text-purple-600" />
              {editingLabel ? t('editLabel') : t('newLabel')}
            </h3>
            <p className="text-xs text-slate-500 mb-4">{t('labelModalLead')}</p>

            <form onSubmit={handleSaveLabel} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t('labelNameRequired')}
                </label>
                <input
                  type="text"
                  required
                  placeholder={t('labelNamePlaceholder')}
                  value={labelName}
                  onChange={(e) => setLabelName(e.target.value)}
                  className="w-full text-sm bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t('bankAccountRequired')}
                </label>
                <select
                  required
                  value={labelAccountId}
                  onChange={(e) => setLabelAccountId(e.target.value)}
                  className="w-full text-sm bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {accountSelectLabel(acc)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  {t('labelColor')}
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  {LABEL_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setLabelColor(c)}
                      className={`w-7 h-7 rounded-full transition-transform ${
                        labelColor === c ? 'ring-2 ring-offset-2 ring-slate-900 scale-110' : ''
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsLabelModalOpen(false)}
                  className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-lg"
                >
                  {tc('cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white rounded-lg shadow-sm"
                >
                  {editingLabel ? t('saveLabel') : t('createLabel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
