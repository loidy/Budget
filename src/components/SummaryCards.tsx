'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { BankAccount } from '../types';
import { useBudgetFormat } from '../i18n/useBudgetFormat';
import type { CashFlowSummary } from '../utils/budgetLogic';
import { TrendingUp, Clock, PiggyBank, ListPlus } from 'lucide-react';

interface SummaryCardsProps {
  summary: CashFlowSummary;
  accounts: BankAccount[];
  monthName: string;
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({ summary, accounts, monthName }) => {
  const t = useTranslations('cashflow');
  const { formatCurrency, formatSignedCurrency } = useBudgetFormat();
  const accountById = new Map(accounts.map((account) => [account.id, account]));

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-4 lg:mb-6 px-4 lg:px-0">
      <div className="bg-white rounded-2xl p-4 lg:p-5 border border-slate-200/90 shadow-2xs">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            {t('plannedExpenses')}
          </span>
          <span className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
            <ListPlus className="w-4 h-4" />
          </span>
        </div>
        <div
          className={`text-xl lg:text-2xl font-bold font-mono tracking-tight ${
            summary.customNetUnpaid >= 0 ? 'text-emerald-700' : 'text-rose-700'
          }`}
        >
          {formatSignedCurrency(summary.customNetUnpaid)}
        </div>
        <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
          <span>{t('totalInPlan')}</span>
          <span
            className={`font-semibold font-mono ${
              summary.customNetAll >= 0 ? 'text-emerald-700' : 'text-rose-700'
            }`}
          >
            {formatSignedCurrency(summary.customNetAll)}
          </span>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-4 lg:p-5 border border-blue-200 shadow-xs ring-1 ring-blue-100">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-blue-900 uppercase tracking-wider">
            {t('currentStatus')}
          </span>
          <span className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
            <Clock className="w-4 h-4" />
          </span>
        </div>
        <div className="text-xl lg:text-2xl font-bold text-blue-900 font-mono tracking-tight">
          {formatCurrency(summary.currentDayBalance)}
        </div>
        <div className="text-[11px] text-blue-700/80 mt-1 font-medium">
          {t('actualAfterToday')}
        </div>
      </div>

      <div className="bg-white rounded-2xl p-4 lg:p-5 border border-slate-200/90 shadow-2xs">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            {t('monthTurnover', { month: monthName })}
          </span>
          <span className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
            <TrendingUp className="w-4 h-4" />
          </span>
        </div>
        <div
          className={`text-xl lg:text-2xl font-bold font-mono tracking-tight ${
            summary.netCashFlow >= 0 ? 'text-emerald-700' : 'text-rose-700'
          }`}
        >
          {formatSignedCurrency(summary.netCashFlow)}
        </div>
        <div className="text-[11px] text-slate-500 mt-2 pt-2 border-t border-slate-100 space-y-1">
          <div className="flex justify-between gap-2">
            <span>{t('regularIncome')}</span>
            <span className="font-semibold font-mono text-emerald-700">
              +{formatCurrency(summary.regularIncome)}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span>{t('regularExpenses')}</span>
            <span className="font-semibold font-mono text-rose-700">
              -{formatCurrency(summary.regularExpense)}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span>{t('plannedExpenses')}</span>
            <span
              className={`font-semibold font-mono ${
                summary.customNetAll >= 0 ? 'text-emerald-700' : 'text-rose-700'
              }`}
            >
              {formatSignedCurrency(summary.customNetAll)}
            </span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-4 lg:p-5 border border-slate-200/90 shadow-2xs">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            {t('expectedBalance')}
          </span>
          <span className="w-8 h-8 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center">
            <PiggyBank className="w-4 h-4" />
          </span>
        </div>
        <div className="text-xl lg:text-2xl font-bold text-slate-900 font-mono tracking-tight">
          {formatCurrency(summary.projectedEndBalance)}
        </div>
        <div className="mt-2 space-y-1">
          {summary.byAccount.map((row) => {
            const account = accountById.get(row.accountId);
            if (!account) return null;
            return (
              <div
                key={row.accountId}
                className="flex items-center justify-between gap-2 text-[11px] text-slate-500"
              >
                <span className="flex items-center gap-1.5 min-w-0">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: account.color }}
                  />
                  <span className="truncate">{account.name}</span>
                </span>
                <span className="font-semibold font-mono text-slate-700">
                  {formatCurrency(row.projectedEnd)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
