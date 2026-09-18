'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { formatMonthKey, parseMonthKey } from '../utils/formatters';
import { useBudgetFormat } from '../i18n/useBudgetFormat';

interface MonthYearPickerProps {
  monthKey: string;
  todayMonthKey: string;
  onChange: (monthKey: string) => void;
  minMonthKey?: string;
  maxMonthKey?: string;
}

export function MonthYearPicker({
  monthKey,
  todayMonthKey,
  onChange,
  minMonthKey,
  maxMonthKey,
}: MonthYearPickerProps) {
  const t = useTranslations('common');
  const { getMonthName, getMonthNames } = useBudgetFormat();
  const monthNames = getMonthNames();
  const { year, month } = parseMonthKey(monthKey);
  const { year: todayYear, month: todayMonth } = parseMonthKey(todayMonthKey);
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(year);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) setViewYear(year);
  }, [open, year]);

  useEffect(() => {
    if (!open) return;

    const handlePointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-800 bg-white hover:bg-slate-50 rounded-lg border border-slate-200 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
        aria-label={t('pickMonthYear')}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span>
          {getMonthName(month)} {year}
        </span>
        <ChevronDown
          className={`w-3 h-3 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={t('pickMonthYear')}
          className="absolute right-0 z-30 mt-1 w-64 rounded-lg border border-slate-200 bg-white p-2 shadow-lg"
        >
          <div className="flex items-center justify-between px-1 pb-2">
            <button
              type="button"
              onClick={() => setViewYear((current) => current - 1)}
              className="p-1 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              aria-label={t('previousYear')}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-semibold text-slate-800 tabular-nums">{viewYear}</span>
            <button
              type="button"
              onClick={() => setViewYear((current) => current + 1)}
              className="p-1 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              aria-label={t('nextYear')}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-1">
            {monthNames.map((name, index) => {
              const monthNumber = index + 1;
              const candidateKey = formatMonthKey(viewYear, monthNumber);
              const isSelected = viewYear === year && monthNumber === month;
              const isToday = viewYear === todayYear && monthNumber === todayMonth;
              const isDisabled =
                Boolean(minMonthKey && candidateKey < minMonthKey) ||
                Boolean(maxMonthKey && candidateKey > maxMonthKey);

              return (
                <button
                  key={name}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => {
                    onChange(candidateKey);
                    setOpen(false);
                  }}
                  className={`px-1 py-1.5 text-[11px] leading-tight font-medium rounded-md transition-colors ${
                    isSelected
                      ? 'bg-blue-600 text-white'
                      : isDisabled
                        ? 'text-slate-300 cursor-not-allowed'
                        : isToday
                          ? 'text-blue-700 bg-blue-50 hover:bg-blue-100'
                          : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {name}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
