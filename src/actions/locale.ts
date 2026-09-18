'use server';

import { cookies } from 'next/headers';
import { defaultLocale, isAppLocale, LOCALE_COOKIE, type AppLocale } from '../i18n/config';

export async function setLocale(locale: AppLocale): Promise<void> {
  const next = isAppLocale(locale) ? locale : defaultLocale;
  const store = await cookies();
  store.set(LOCALE_COOKIE, next, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  });
}
