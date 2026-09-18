'use client';

import React, { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown, Lock } from 'lucide-react';
import type {
  CatalogItem,
  CatalogKind,
  CatalogSnapshot,
  CatalogViewState,
  House,
} from '../types';
import { defaultCatalogViewState, sanitizeCatalogViewState } from '../lib/catalogView';
import {
  latestCatalogValidUntil,
  snapshotValidUntilBounds,
} from '../utils/budgetLogic';
import { formatMonthSlash, shiftMonthKey } from '../utils/formatters';
import { DeleteConfirmButton } from './BudgetTableUi';
import { IncomeExpenseTable } from './IncomeExpenseTable';
import { MonthYearPicker } from './MonthYearPicker';

function defaultLockMonth(todayMonthKey: string, minMonthKey?: string): string {
  const previous = shiftMonthKey(todayMonthKey, -1);
  if (minMonthKey && previous < minMonthKey) return minMonthKey;
  return previous;
}

export function LockCatalogButton({
  house,
  todayMonthKey,
  onLock,
}: {
  house: House;
  todayMonthKey: string;
  onLock: (validUntil: string) => void;
}) {
  const t = useTranslations('catalog');
  const tc = useTranslations('common');
  const latest = latestCatalogValidUntil(house);
  const minMonthKey = latest ? shiftMonthKey(latest, 1) : undefined;
  const [open, setOpen] = useState(false);
  const [monthKey, setMonthKey] = useState(() => defaultLockMonth(todayMonthKey, minMonthKey));

  const openForm = () => {
    setMonthKey(defaultLockMonth(todayMonthKey, minMonthKey));
    setOpen(true);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={openForm}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 rounded-lg border border-slate-200"
      >
        <Lock className="w-3.5 h-3.5" />
        {t('lockValues')}
      </button>
    );
  }

  return (
    <form
      className="flex items-center gap-1.5"
      onSubmit={(event) => {
        event.preventDefault();
        if (minMonthKey && monthKey < minMonthKey) return;
        onLock(monthKey);
        setOpen(false);
      }}
    >
      <span className="text-xs font-medium text-slate-500 whitespace-nowrap">{t('validUntilLabel')}</span>
      <MonthYearPicker
        monthKey={monthKey}
        todayMonthKey={todayMonthKey}
        minMonthKey={minMonthKey}
        onChange={setMonthKey}
      />
      <button
        type="submit"
        className="px-2.5 py-1 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-md"
      >
        {t('lock')}
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900"
      >
        {tc('cancel')}
      </button>
    </form>
  );
}

export function CatalogHistory({
  house,
  todayMonthKey,
  onSaveItem,
  onDeleteItem,
  onReorderItems,
  onChangeValidUntil,
  onDeleteSnapshot,
}: {
  house: House;
  todayMonthKey: string;
  onSaveItem: (
    item: CatalogItem,
    previousKind?: CatalogKind,
    placement?: { beforeId?: string; afterId?: string },
    snapshotId?: string | null
  ) => void;
  onDeleteItem: (itemId: string, snapshotId?: string | null) => void;
  onReorderItems: (orderedItemIds: string[], snapshotId?: string | null) => void;
  onChangeValidUntil: (snapshotId: string, validUntil: string) => void;
  onDeleteSnapshot: (snapshotId: string) => void;
}) {
  const t = useTranslations('catalog');
  const [open, setOpen] = useState(false);
  const [viewById, setViewById] = useState<Record<string, CatalogViewState>>({});
  const snapshots = useMemo(
    () =>
      [...(house.catalogSnapshots ?? [])].sort((a, b) => b.validUntil.localeCompare(a.validUntil)),
    [house.catalogSnapshots]
  );

  if (snapshots.length === 0) return null;

  return (
    <div className="mb-6">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-white rounded-none lg:rounded-2xl border border-slate-200/90 border-x-0 lg:border-x shadow-sm text-left hover:bg-slate-50 transition-colors"
        aria-expanded={open}
      >
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900">{t('history')}</div>
          <div className="text-xs text-slate-500">{t('tableCount', { count: snapshots.length })}</div>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open
        ? snapshots.map((snapshot) => (
            <SnapshotTable
              key={snapshot.id}
              house={house}
              snapshot={snapshot}
              todayMonthKey={todayMonthKey}
              viewState={sanitizeCatalogViewState(
                viewById[snapshot.id] ?? defaultCatalogViewState(house),
                house
              )}
              onViewStateChange={(state) =>
                setViewById((current) => ({ ...current, [snapshot.id]: state }))
              }
              onSaveItem={onSaveItem}
              onDeleteItem={onDeleteItem}
              onReorderItems={onReorderItems}
              onChangeValidUntil={onChangeValidUntil}
              onDeleteSnapshot={onDeleteSnapshot}
            />
          ))
        : null}
    </div>
  );
}

function SnapshotTable({
  house,
  snapshot,
  todayMonthKey,
  viewState,
  onViewStateChange,
  onSaveItem,
  onDeleteItem,
  onReorderItems,
  onChangeValidUntil,
  onDeleteSnapshot,
}: {
  house: House;
  snapshot: CatalogSnapshot;
  todayMonthKey: string;
  viewState: CatalogViewState;
  onViewStateChange: (state: CatalogViewState) => void;
  onSaveItem: CatalogHistoryProps['onSaveItem'];
  onDeleteItem: CatalogHistoryProps['onDeleteItem'];
  onReorderItems: CatalogHistoryProps['onReorderItems'];
  onChangeValidUntil: (snapshotId: string, validUntil: string) => void;
  onDeleteSnapshot: (snapshotId: string) => void;
}) {
  const t = useTranslations('catalog');
  const bounds = snapshotValidUntilBounds(house, snapshot.id);

  return (
    <div className="mt-4">
      <IncomeExpenseTable
        house={house}
        snapshotId={snapshot.id}
        viewState={viewState}
        onViewStateChange={onViewStateChange}
        title={
          <h3 className="text-lg font-semibold text-slate-900 truncate">
            {t('validUntil', { month: formatMonthSlash(snapshot.validUntil) })}
          </h3>
        }
        headerActions={
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500">{t('validUntilLabel')}</span>
            <MonthYearPicker
              monthKey={snapshot.validUntil}
              todayMonthKey={todayMonthKey}
              minMonthKey={bounds.minMonthKey}
              maxMonthKey={bounds.maxMonthKey}
              onChange={(validUntil) => onChangeValidUntil(snapshot.id, validUntil)}
            />
            <DeleteConfirmButton
              onConfirm={() => onDeleteSnapshot(snapshot.id)}
              title={t('deleteHistoryTable')}
            />
          </div>
        }
        onSaveItem={onSaveItem}
        onDeleteItem={onDeleteItem}
        onReorderItems={onReorderItems}
      />
    </div>
  );
}

type CatalogHistoryProps = React.ComponentProps<typeof CatalogHistory>;
