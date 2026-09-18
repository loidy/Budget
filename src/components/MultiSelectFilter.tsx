'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Tag } from 'lucide-react';
import { useTranslations } from 'next-intl';

export interface MultiSelectOption {
  id: string;
  label: string;
  color?: string;
  variant?: 'label' | 'account';
}

interface MultiSelectFilterProps {
  label: string;
  options: MultiSelectOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  align?: 'left' | 'right';
  readOnly?: boolean;
}

export function MultiSelectFilter({
  label,
  options,
  selectedIds,
  onChange,
  align = 'right',
  readOnly = false,
}: MultiSelectFilterProps) {
  const t = useTranslations('common');
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || readOnly) return;

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
  }, [open, readOnly]);

  const allSelected = options.length > 0 && selectedIds.length === options.length;
  const noneSelected = selectedIds.length === 0;

  const singleSelectedLabel =
    selectedIds.length === 1
      ? options.find((option) => option.id === selectedIds[0])?.label
      : undefined;

  const summary = noneSelected
    ? t('filterNone', { label })
    : allSelected
      ? t('filterAll', { label })
      : singleSelectedLabel
        ? `${label}: ${singleSelectedLabel}`
        : t('filterCount', { label, selected: selectedIds.length, total: options.length });

  const toggleId = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((selected) => selected !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => {
          if (readOnly) return;
          setOpen((value) => !value);
        }}
        disabled={readOnly}
        className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md font-medium border transition-all ${
          open || !allSelected
            ? 'bg-white text-slate-900 shadow-2xs border-slate-200'
            : 'bg-transparent text-slate-600 border-transparent hover:text-slate-900'
        } ${readOnly ? 'cursor-default opacity-90 hover:text-slate-900' : ''}`}
        aria-haspopup={readOnly ? undefined : 'listbox'}
        aria-expanded={readOnly ? undefined : open}
        aria-disabled={readOnly}
      >
        <span>{summary}</span>
        {!readOnly && (
          <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        )}
      </button>

      {open && !readOnly && (
        <div
          className={`absolute z-30 mt-1 w-64 rounded-lg border border-slate-200 bg-white shadow-lg ${
            align === 'left' ? 'left-0' : 'right-0'
          }`}
        >
          <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 border-b border-slate-100">
            <button
              type="button"
              onClick={() => onChange(options.map((option) => option.id))}
              className="text-[11px] font-semibold text-blue-600 hover:text-blue-800"
            >
              {t('selectAll')}
            </button>
            <button
              type="button"
              onClick={() => onChange([])}
              className="text-[11px] font-semibold text-slate-500 hover:text-slate-800"
            >
              {t('selectNone')}
            </button>
          </div>

          <ul role="listbox" className="max-h-64 overflow-y-auto py-1">
            {options.length === 0 ? (
              <li className="px-3 py-2 text-xs text-slate-400">{t('noOptions')}</li>
            ) : (
              options.map((option) => {
                const checked = selectedIds.includes(option.id);
                return (
                  <li key={option.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={checked}
                      onClick={() => toggleId(option.id)}
                      className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs hover:bg-slate-50"
                    >
                      <span
                        className={`flex h-3.5 w-3.5 items-center justify-center rounded border ${
                          checked
                            ? 'border-blue-600 bg-blue-600 text-white'
                            : 'border-slate-300 bg-white'
                        }`}
                      >
                        {checked && <Check className="w-2.5 h-2.5" />}
                      </span>
                      {option.variant === 'label' && option.color ? (
                        <span
                          className="inline-flex max-w-full min-w-0 items-center gap-1 px-2 h-5 rounded-full text-[11px] font-medium text-white"
                          style={{ backgroundColor: option.color }}
                        >
                          <Tag className="w-3 h-3 shrink-0" />
                          <span className="truncate">{option.label}</span>
                        </span>
                      ) : (
                        <>
                          {option.color && (
                            <span
                              className="h-2.5 w-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: option.color }}
                            />
                          )}
                          <span className="truncate text-slate-800">{option.label}</span>
                        </>
                      )}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
