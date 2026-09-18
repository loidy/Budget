'use client';

import React from 'react';
import { BankAccount, ItemLabel } from '../types';
import { useTranslations } from 'next-intl';
import { useBudgetFormat } from '../i18n/useBudgetFormat';

interface ItemAccountLabelFieldsProps {
  accounts: BankAccount[];
  labels: ItemLabel[];
  labelId: string;
  accountId: string;
  onChange: (next: { labelId: string; accountId: string }) => void;
}

export function ItemAccountLabelFields({
  accounts,
  labels,
  labelId,
  accountId,
  onChange,
}: ItemAccountLabelFieldsProps) {
  const t = useTranslations('accounts');
  const tc = useTranslations('common');
  const { accountSelectLabel } = useBudgetFormat();
  const selectedLabel = labels.find((label) => label.id === labelId);
  const effectiveAccountId = selectedLabel?.accountId || accountId;
  const accountLocked = Boolean(selectedLabel);

  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">
          {t('labelOptional')}
        </label>
        <select
          value={labelId}
          onChange={(e) => {
            const nextLabelId = e.target.value;
            const nextLabel = labels.find((label) => label.id === nextLabelId);
            onChange({
              labelId: nextLabelId,
              accountId: nextLabel?.accountId || accountId || accounts[0]?.id || '',
            });
          }}
          className="w-full text-sm bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
        >
          <option value="">{t('noLabelOption')}</option>
          {accounts.map((acc) => {
            const accountLabels = labels.filter((label) => label.accountId === acc.id);
            if (accountLabels.length === 0) return null;

            return (
              <optgroup key={acc.id} label={accountSelectLabel(acc)}>
                {accountLabels.map((lbl) => (
                  <option key={lbl.id} value={lbl.id}>
                    {lbl.name}
                  </option>
                ))}
              </optgroup>
            );
          })}
        </select>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">
          {t('bankAccount')}
        </label>
        <select
          value={effectiveAccountId}
          disabled={accountLocked}
          onChange={(e) => onChange({ labelId, accountId: e.target.value })}
          className="w-full text-sm bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-500"
        >
          {accounts.map((acc) => (
            <option key={acc.id} value={acc.id}>
              {accountSelectLabel(acc)}
            </option>
          ))}
        </select>
        <span className="text-[10px] text-slate-400 block mt-0.5">
          {accountLocked
            ? tc('accountFromLabel')
            : t('pickAccountDirectly')}
        </span>
      </div>
    </div>
  );
}
