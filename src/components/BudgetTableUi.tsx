'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, ChevronUp, ChevronsUpDown, GripVertical, Plus, Tag, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

export type SortDir = 'asc' | 'desc';

export const INLINE_INPUT_CLASS =
  'h-6 w-full max-w-full min-w-0 m-0 box-border text-xs leading-none bg-white border border-slate-300 rounded-md px-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500';
export const INLINE_NUMBER_CLASS = `${INLINE_INPUT_CLASS} [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`;
export const MOBILE_INPUT_CLASS =
  'h-11 w-full max-w-full min-w-0 m-0 box-border text-base leading-none bg-white border border-slate-300 rounded-lg px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500';
export const MOBILE_NUMBER_CLASS = `${MOBILE_INPUT_CLASS} [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`;

export const PLAN_CELL =
  'h-14 max-h-14 min-w-0 overflow-hidden px-4 py-0 align-middle text-xs border-b';
export const PLAN_CELL_HANDLE =
  'h-14 max-h-14 min-w-0 overflow-hidden px-1 py-0 align-middle text-xs text-center border-b';
export const PLAN_CELL_ACTIONS =
  'h-14 max-h-14 min-w-0 overflow-visible px-4 py-0 align-middle text-xs text-right border-b';

export function SortableHeader<K extends string>({
  label,
  column,
  sortKey,
  sortDir,
  onSort,
  align = 'left',
  className = '',
}: {
  label: string;
  column: K;
  sortKey: K;
  sortDir: SortDir;
  onSort?: (key: K) => void;
  align?: 'left' | 'center' | 'right';
  className?: string;
}) {
  const active = sortKey === column;
  const alignClass =
    align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start';
  const textAlign = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';
  const indicator = active ? (
    sortDir === 'asc' ? (
      <ChevronUp className="w-3 h-3" />
    ) : (
      <ChevronDown className="w-3 h-3" />
    )
  ) : (
    <ChevronsUpDown className="w-3 h-3 opacity-40" />
  );

  return (
    <th className={`py-3 px-4 border-b border-slate-200 whitespace-nowrap ${textAlign} ${className}`}>
      {onSort ? (
        <button
          type="button"
          onClick={() => onSort(column)}
          className={`inline-flex items-center gap-1 uppercase tracking-wider ${alignClass} w-full hover:text-slate-800`}
        >
          <span>{label}</span>
          {indicator}
        </button>
      ) : (
        <span className={`inline-flex items-center gap-1 uppercase tracking-wider ${alignClass} w-full`}>
          <span>{label}</span>
          {indicator}
        </span>
      )}
    </th>
  );
}

export type InlineSelectOption = {
  value: string;
  label: string;
  color?: string;
  variant?: 'label' | 'account' | 'badge';
  badgeClassName?: string;
  group?: string;
  groupColor?: string;
};

export function SelectOptionVisual({
  label,
  color,
  variant,
  badgeClassName,
  compact = false,
}: {
  label: string;
  color?: string;
  variant?: InlineSelectOption['variant'];
  badgeClassName?: string;
  compact?: boolean;
}) {
  if (variant === 'badge') {
    return (
      <span
        className={`inline-flex max-w-full min-w-0 items-center rounded font-medium ${
          compact ? 'h-5 px-1.5 text-[10px]' : 'h-6 px-2 text-[11px]'
        } ${badgeClassName ?? 'text-slate-600 bg-slate-100'}`}
      >
        <span className="truncate">{label}</span>
      </span>
    );
  }

  if (variant === 'label' && color) {
    return (
      <span
        className={`inline-flex max-w-full min-w-0 items-center gap-1 rounded-full font-medium text-white ${
          compact ? 'px-1.5 h-5 text-[10px]' : 'px-2 h-6 text-[11px]'
        }`}
        style={{ backgroundColor: color }}
      >
        <Tag className={`${compact ? 'h-2.5 w-2.5' : 'h-3 w-3'} shrink-0`} />
        <span className="truncate">{label}</span>
      </span>
    );
  }

  if (variant === 'account' && color) {
    return (
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
        <span className="truncate font-medium text-slate-800">{label}</span>
      </span>
    );
  }

  return <span className="truncate text-slate-600">{label}</span>;
}

export function InlineSelect({
  value,
  onChange,
  options,
  disabled = false,
  className = '',
  title,
  'aria-label': ariaLabel,
  size = 'inline',
}: {
  value: string;
  onChange: (value: string) => void;
  options: InlineSelectOption[];
  disabled?: boolean;
  className?: string;
  title?: string;
  'aria-label'?: string;
  size?: 'inline' | 'mobile';
}) {
  const t = useTranslations('common');
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties | null>(null);
  const selected = options.find((option) => option.value === value);

  const updateMenuPosition = () => {
    const trigger = rootRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const width = Math.max(rect.width, 220);
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < 200 && rect.top > spaceBelow;
    setMenuStyle({
      position: 'fixed',
      left,
      width,
      zIndex: 50,
      ...(openUp ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
    });
  };

  useEffect(() => {
    if (!open) {
      setMenuStyle(null);
      return;
    }
    updateMenuPosition();
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const handlePointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
      }
    };
    const close = () => setOpen(false);

    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey, true);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey, true);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  const menu =
    open && menuStyle
      ? createPortal(
          <div ref={menuRef} style={menuStyle} className="rounded-lg border border-slate-200 bg-white shadow-lg">
            <ul role="listbox" className="max-h-56 overflow-y-auto py-1">
              {options.length === 0 ? (
                <li className="px-3 py-2 text-xs text-slate-400">{t('noOptions')}</li>
              ) : (
                options.map((option, index) => {
                  const prevGroup = options[index - 1]?.group;
                  const showGroup = Boolean(option.group && option.group !== prevGroup);
                  const isSelected = option.value === value;
                  return (
                    <React.Fragment key={option.value || '__empty'}>
                      {showGroup && (
                        <li className="flex items-center gap-1.5 px-2.5 pt-2 pb-1">
                          {option.groupColor && (
                            <span
                              className="h-2 w-2 shrink-0 rounded-full"
                              style={{ backgroundColor: option.groupColor }}
                            />
                          )}
                          <span className="truncate text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                            {option.group}
                          </span>
                        </li>
                      )}
                      <li>
                        <button
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          onClick={() => {
                            onChange(option.value);
                            setOpen(false);
                          }}
                          className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs ${
                            isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'
                          }`}
                        >
                          <span className="min-w-0 flex-1">
                            <SelectOptionVisual
                              label={option.label}
                              color={option.color}
                              variant={option.variant}
                              badgeClassName={option.badgeClassName}
                            />
                          </span>
                          {isSelected && <Check className="h-3 w-3 shrink-0 text-blue-600" />}
                        </button>
                      </li>
                    </React.Fragment>
                  );
                })
              )}
            </ul>
          </div>,
          document.body
        )
      : null;

  return (
    <div ref={rootRef} className="relative w-full min-w-0 max-w-full" data-inline-select>
      <button
        type="button"
        disabled={disabled}
        title={title}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          if (disabled) return;
          if (open) {
            setOpen(false);
            return;
          }
          updateMenuPosition();
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.stopPropagation();
            if (!open && !disabled) {
              event.preventDefault();
              setOpen(true);
            }
          }
          if (event.key === 'Escape' && open) {
            event.preventDefault();
            event.stopPropagation();
            setOpen(false);
          }
        }}
        className={`${size === 'mobile' ? MOBILE_INPUT_CLASS : INLINE_INPUT_CLASS} flex items-center justify-between gap-1 pr-1.5 cursor-pointer ${
          disabled ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''
        } ${className}`}
      >
        <span className="min-w-0 flex-1 text-left">
          <SelectOptionVisual
            label={selected?.label ?? ''}
            color={selected?.color}
            variant={selected?.variant}
            badgeClassName={selected?.badgeClassName}
            compact
          />
        </span>
        <ChevronDown className={`h-3 w-3 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {menu}
    </div>
  );
}

export function DeleteConfirmButton({ onConfirm, title }: { onConfirm: () => void; title: string }) {
  const t = useTranslations('common');
  const [confirming, setConfirming] = useState(false);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const overlayRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!confirming) {
      setAnchor(null);
      return;
    }

    const updateAnchor = () => {
      if (buttonRef.current) setAnchor(buttonRef.current.getBoundingClientRect());
    };
    updateAnchor();

    const handlePointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || overlayRef.current?.contains(target)) {
        return;
      }
      setConfirming(false);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setConfirming(false);
    };
    const timeout = window.setTimeout(() => setConfirming(false), 4000);

    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);
    window.addEventListener('scroll', updateAnchor, true);
    window.addEventListener('resize', updateAnchor);
    return () => {
      window.clearTimeout(timeout);
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
      window.removeEventListener('scroll', updateAnchor, true);
      window.removeEventListener('resize', updateAnchor);
    };
  }, [confirming]);

  return (
    <div ref={rootRef} className="relative inline-flex shrink-0 items-center justify-center">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setConfirming(true)}
        className={`p-1 rounded ${
          confirming ? 'invisible pointer-events-none' : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
        }`}
        title={title}
        aria-label={title}
        aria-expanded={confirming}
        tabIndex={confirming ? -1 : undefined}
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
      {confirming &&
        anchor &&
        createPortal(
          <button
            ref={overlayRef}
            type="button"
            onClick={onConfirm}
            style={{
              position: 'fixed',
              top: anchor.top + anchor.height / 2,
              left: anchor.right,
              transform: 'translate(-100%, -50%)',
              zIndex: 50,
            }}
            className="inline-flex items-center h-6 px-2 text-[10px] font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-md shadow-md whitespace-nowrap"
            title={t('confirmDelete')}
            aria-label={t('confirmDelete')}
          >
            {t('confirm')}
          </button>,
          document.body
        )}
    </div>
  );
}

export function OrderHandle({
  enabled,
  onDragStart,
  onDragEnd,
}: {
  enabled: boolean;
  onDragStart: (event: React.DragEvent<HTMLSpanElement>) => void;
  onDragEnd: () => void;
}) {
  const t = useTranslations('common');
  if (!enabled) {
    return (
      <span
        className="inline-flex text-slate-300 cursor-not-allowed select-none"
        title={t('reorderOnlyDefaultSort')}
        aria-disabled="true"
      >
        <GripVertical className="w-3.5 h-3.5" />
      </span>
    );
  }

  return (
    <span
      draggable
      onDragStart={(event) => {
        event.stopPropagation();
        onDragStart(event);
      }}
      onDragEnd={onDragEnd}
      className="inline-flex text-slate-400 hover:text-slate-600 cursor-grab active:cursor-grabbing select-none"
      title={t('moveItem')}
    >
      <GripVertical className="w-3.5 h-3.5" />
    </span>
  );
}

export function InsertGapRow({
  onAdd,
  columnCount,
  inactive = false,
}: {
  onAdd: () => void;
  columnCount: number;
  inactive?: boolean;
}) {
  const t = useTranslations('common');
  return (
    <tr className={`group/insert ${inactive ? 'pointer-events-none' : ''}`}>
      <td colSpan={columnCount} className="p-0 h-2 relative overflow-visible">
        <button
          type="button"
          onClick={onAdd}
          className="absolute z-20 left-0 right-0 top-1/2 -translate-y-1/2 h-6 flex items-center opacity-0 pointer-events-none group-hover/insert:opacity-100 group-hover/insert:pointer-events-auto transition-opacity"
          title={t('addItemHere')}
        >
          <span className="flex-1 mx-4 border-t border-dashed border-blue-300" />
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white shadow-sm shrink-0">
            <Plus className="w-3 h-3" />
          </span>
          <span className="flex-1 mx-4 border-t border-dashed border-blue-300" />
        </button>
      </td>
    </tr>
  );
}
