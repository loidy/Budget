'use client';

import { useLocale, useTranslations } from 'next-intl';
import { collatorLocale } from './config';
import {
  accountSelectLabel,
  formatCurrency,
  formatDayMonth,
  formatDayMonthYear,
  formatExpenseIncomePercent,
  formatSignedCurrency,
  getMonthName,
  getMonthNames,
  getMonthShortName,
} from '../utils/formatters';

export function useBudgetFormat() {
  const locale = useLocale();
  const t = useTranslations('accounts');

  return {
    locale,
    formatCurrency: (amount: number) => formatCurrency(amount, locale),
    formatSignedCurrency: (amount: number) => formatSignedCurrency(amount, locale),
    getMonthName: (month: number) => getMonthName(month, locale),
    getMonthShortName: (month: number) => getMonthShortName(month, locale),
    getMonthNames: () => getMonthNames(locale),
    formatDayMonthYear: (day: number, month: number, year: number) =>
      formatDayMonthYear(day, month, year, locale),
    formatDayMonth: (day: number, month: number) => formatDayMonth(day, month, locale),
    formatExpenseIncomePercent: (percent: number | null) =>
      formatExpenseIncomePercent(percent, locale),
    accountSelectLabel: (account: { name: string; visibility: number }) =>
      accountSelectLabel(account, {
        hidden: t('hiddenSuffix'),
        offOverview: t('offOverviewSuffix'),
      }),
    collator: new Intl.Collator(collatorLocale(locale)),
  };
}
