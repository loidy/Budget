import { intlTag } from '../i18n/config';

const EUR = '€';

function capitalize(value: string, locale: string): string {
  if (!value) return value;
  return value.charAt(0).toLocaleUpperCase(intlTag(locale)) + value.slice(1);
}

export function formatCurrency(amount: number, locale = 'en'): string {
  const isNeg = amount < 0;
  const absVal = Math.abs(amount);
  const formatted = new Intl.NumberFormat(intlTag(locale), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(absVal);

  return `${isNeg ? '-' : ''}${formatted} ${EUR}`;
}

export function formatSignedCurrency(amount: number, locale = 'en'): string {
  const formatted = new Intl.NumberFormat(intlTag(locale), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount));

  if (amount > 0) return `+${formatted} ${EUR}`;
  if (amount < 0) return `-${formatted} ${EUR}`;
  return `${new Intl.NumberFormat(intlTag(locale), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(0)} ${EUR}`;
}

export function getMonthName(month: number, locale = 'en'): string {
  if (month < 1 || month > 12) return '';
  const value = new Intl.DateTimeFormat(intlTag(locale), { month: 'long' }).format(
    new Date(2020, month - 1, 1)
  );
  return capitalize(value, locale);
}

export function getMonthShortName(month: number, locale = 'en'): string {
  if (month < 1 || month > 12) return '';
  const value = new Intl.DateTimeFormat(intlTag(locale), { month: 'short' }).format(
    new Date(2020, month - 1, 1)
  );
  return capitalize(value.replace(/\.$/, ''), locale);
}

export function getMonthNames(locale = 'en'): string[] {
  return Array.from({ length: 12 }, (_, index) => getMonthName(index + 1, locale));
}

export function formatDayMonthYear(day: number, month: number, year: number, locale = 'en'): string {
  return new Intl.DateTimeFormat(intlTag(locale), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, month - 1, day));
}

export function formatDayMonth(day: number, month: number, locale = 'en'): string {
  return new Intl.DateTimeFormat(intlTag(locale), {
    day: 'numeric',
    month: 'long',
  }).format(new Date(2020, month - 1, day));
}

export function formatExpenseIncomePercent(percent: number | null, locale = 'en'): string {
  if (percent == null) return '—';
  return `${percent.toLocaleString(intlTag(locale), {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  })} %`;
}

export function getDaysInMonth(year: number, month: number): number {
  // month: 1 - 12
  return new Date(year, month, 0).getDate();
}

export function parseMonthKey(monthKey: string): { year: number; month: number } {
  const [yearStr, monthStr] = monthKey.split('-');
  return {
    year: parseInt(yearStr, 10) || 2026,
    month: parseInt(monthStr, 10) || 9,
  };
}

export function formatMonthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function formatMonthSlash(monthKey: string): string {
  const { year, month } = parseMonthKey(monthKey);
  return `${String(month).padStart(2, '0')}/${year}`;
}

export function shiftMonthKey(monthKey: string, delta: number): string {
  const { year, month } = parseMonthKey(monthKey);
  const date = new Date(year, month - 1 + delta, 1);
  return formatMonthKey(date.getFullYear(), date.getMonth() + 1);
}

export function accountSelectLabel(
  account: { name: string; visibility: number },
  suffixes: { hidden: string; offOverview: string }
): string {
  if (account.visibility >= 2) return `${account.name} (${suffixes.hidden})`;
  if (account.visibility === 1) return `${account.name} (${suffixes.offOverview})`;
  return account.name;
}

/** Catalog date: monthly items are `15.*`, yearly expenses are `15.3.` */
export function formatCatalogDate(day: number, month?: number | null): string {
  if (month) return `${day}.${month}.`;
  return `${day}.*`;
}
