'use client';

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Check, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface MobileEditorSheetProps {
  open: boolean;
  title: string;
  onSave: () => void;
  onCancel: () => void;
  children: React.ReactNode;
}

export function MobileEditorSheet({
  open,
  title,
  onSave,
  onCancel,
  children,
}: MobileEditorSheetProps) {
  const t = useTranslations('common');
  useEffect(() => {
    if (!open) return;
    if (typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKey);
    };
  }, [open, onCancel]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 lg:hidden">
      <button
        type="button"
        aria-label={t('closeEditor')}
        onClick={onCancel}
        className="absolute inset-0 bg-slate-900/50"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-2xl bg-white shadow-2xl"
        style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onSave}
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-blue-600 text-white hover:bg-blue-500"
              title={t('save')}
              aria-label={t('save')}
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              title={t('cancel')}
              aria-label={t('cancel')}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="space-y-3 px-4 py-4">{children}</div>
      </div>
    </div>,
    document.body
  );
}
