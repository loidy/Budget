export const locales = ['en', 'sk'] as const;

export type AppLocale = (typeof locales)[number];

export const defaultLocale: AppLocale = 'en';

export const LOCALE_COOKIE = 'locale';

export function isAppLocale(value: unknown): value is AppLocale {
  return value === 'en' || value === 'sk';
}

export function intlTag(locale: string): string {
  return locale.startsWith('sk') ? 'sk-SK' : 'en-US';
}

export function collatorLocale(locale: string): string {
  return locale.startsWith('sk') ? 'sk' : 'en';
}
