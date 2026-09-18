'use client';

import { useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { setLocale } from '../actions/locale';
import type { AppLocale } from '../i18n/config';

interface LanguageSwitcherProps {
  variant?: 'light' | 'dark';
}

const LOCALES: AppLocale[] = ['en', 'sk'];

export function LanguageSwitcher({ variant = 'light' }: LanguageSwitcherProps) {
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations('language');
  const [pending, startTransition] = useTransition();

  const choose = (next: AppLocale) => {
    if (next === locale || pending) return;
    startTransition(async () => {
      await setLocale(next);
      router.refresh();
    });
  };

  const dark = variant === 'dark';

  return (
    <div
      role="group"
      aria-label={t('label')}
      className={`inline-flex shrink-0 overflow-hidden rounded-lg border text-[11px] font-semibold ${
        dark ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-slate-50'
      }`}
    >
      {LOCALES.map((code) => {
        const active = locale === code;
        return (
          <button
            key={code}
            type="button"
            onClick={() => choose(code)}
            disabled={pending}
            aria-pressed={active}
            title={t(code)}
            className={`px-2 py-1 uppercase tracking-wide transition-colors disabled:opacity-60 ${
              active
                ? dark
                  ? 'bg-blue-600 text-white'
                  : 'bg-blue-600 text-white'
                : dark
                  ? 'text-slate-300 hover:bg-slate-700 hover:text-white'
                  : 'text-slate-600 hover:bg-white hover:text-slate-900'
            }`}
          >
            {code}
          </button>
        );
      })}
    </div>
  );
}
