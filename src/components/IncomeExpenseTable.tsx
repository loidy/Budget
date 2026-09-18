'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CATALOG_KINDS,
  CatalogItem,
  CatalogKind,
  CatalogRow,
  CatalogSortKey,
  CatalogViewState,
  House,
} from '../types';
import { formatCatalogDate } from '../utils/formatters';
import { useTranslations } from 'next-intl';
import { useBudgetFormat } from '../i18n/useBudgetFormat';
import {
  CATALOG_KIND_META,
  catalogDateKey,
  compareCatalogRows,
  catalogScopeById,
  getCatalogRows,
  orderedIdsAfterGroupedMove,
} from '../utils/budgetLogic';
import { Edit3, Info, Plus, RotateCcw, Table, Tag, Check, X } from 'lucide-react';
import { MultiSelectFilter } from './MultiSelectFilter';
import {
  applyCatalogView,
  filterCatalogByAccountAndLabel,
  toggleCatalogSort,
  UNLABELED_ID,
} from '../lib/catalogView';
import {
  DeleteConfirmButton,
  INLINE_INPUT_CLASS,
  INLINE_NUMBER_CLASS,
  MOBILE_INPUT_CLASS,
  MOBILE_NUMBER_CLASS,
  InlineSelect,
  InsertGapRow,
  OrderHandle,
  PLAN_CELL,
  PLAN_CELL_ACTIONS,
  PLAN_CELL_HANDLE,
  SortableHeader,
} from './BudgetTableUi';
import { MobileEditorSheet } from './MobileEditorSheet';
import { MobileRowCard } from './MobileRowCard';

const COLUMN_COUNT = 8;

interface InlineDraft {
  mode: 'add' | 'edit';
  insertIndex: number;
  itemId?: string;
  previousKind?: CatalogKind;
  name: string;
  amount: string;
  day: string;
  month: string;
  kind: CatalogKind;
  accountId: string;
  labelId: string;
  notes: string;
  beforeId?: string;
  afterId?: string;
}

const CATALOG_KIND_LABEL_KEYS = {
  monthly_income: 'kinds.monthly_income',
  monthly_expense: 'kinds.monthly_expense',
  annual_expense: 'kinds.annual_expense',
} as const;

interface IncomeExpenseTableProps {
  house: House;
  viewState: CatalogViewState;
  onViewStateChange?: (state: CatalogViewState) => void;
  title?: React.ReactNode;
  headerActions?: React.ReactNode;
  showInfoTooltip?: boolean;
  onSaveItem: (
    item: CatalogItem,
    previousKind?: CatalogKind,
    placement?: { beforeId?: string; afterId?: string },
    snapshotId?: string | null
  ) => void;
  onDeleteItem: (itemId: string, snapshotId?: string | null) => void;
  onReorderItems: (orderedItemIds: string[], snapshotId?: string | null) => void;
  snapshotId?: string | null;
}

export const IncomeExpenseTable: React.FC<IncomeExpenseTableProps> = ({
  house,
  viewState,
  onViewStateChange,
  title,
  headerActions,
  showInfoTooltip = false,
  onSaveItem,
  onDeleteItem,
  onReorderItems,
  snapshotId = null,
}) => {
  const t = useTranslations('catalog');
  const tc = useTranslations('common');
  const { formatCurrency, formatSignedCurrency, accountSelectLabel, formatExpenseIncomePercent, collator } =
    useBudgetFormat();
  const resolvedTitle = title ?? t('defaultTitle');
  const catalogRows = useMemo(
    () => getCatalogRows(house, catalogScopeById(house, snapshotId)),
    [house, snapshotId]
  );
  const filtersLocked = !onViewStateChange;
  const selectedKindIds = viewState.kindIds;
  const selectedAccountIds = viewState.accountIds;
  const selectedLabelIds = viewState.labelIds;
  const sortKey = viewState.sortKey;
  const sortDir = viewState.sortDir;
  const [inlineDraft, setInlineDraft] = useState<InlineDraft | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [draggingDateKey, setDraggingDateKey] = useState<string | null>(null);
  const [dropHint, setDropHint] = useState<{ id: string; place: 'before' | 'after' } | null>(null);

  const knownLabelIds = useMemo(
    () => new Set(house.labels.map((label) => label.id)),
    [house.labels]
  );

  const canonicalIndex = useMemo(() => {
    const indexById = new Map<string, number>();
    catalogRows.forEach((item, index) => {
      indexById.set(item.id, index);
    });
    return indexById;
  }, [catalogRows]);

  const kindScopedItems = useMemo(
    () => filterCatalogByAccountAndLabel(catalogRows, viewState, knownLabelIds),
    [catalogRows, viewState, knownLabelIds]
  );

  const filteredItems = useMemo(
    () => applyCatalogView(catalogRows, viewState, knownLabelIds),
    [catalogRows, viewState, knownLabelIds]
  );

  const displayItems = useMemo(() => {
    const sorted = [...filteredItems];
    sorted.sort((a, b) => compareDisplayItems(a, b, sortKey, sortDir, canonicalIndex, collator));
    return sorted;
  }, [filteredItems, sortKey, sortDir, canonicalIndex, collator]);

  const isChronologicalSort = sortKey === 'date' && sortDir === 'asc';
  const reorderEnabled = isChronologicalSort && !inlineDraft;

  const defaultKind = (): CatalogKind => {
    if (selectedKindIds.length === 1 && CATALOG_KINDS.includes(selectedKindIds[0] as CatalogKind)) {
      return selectedKindIds[0] as CatalogKind;
    }
    return 'monthly_expense';
  };

  const startInlineAdd = (
    insertIndex: number,
    preset?: { day?: number; month?: number; kind?: CatalogKind },
    beforeId?: string,
    afterId?: string
  ) => {
    const kind = preset?.kind ?? defaultKind();
    const defaultAccount =
      selectedAccountIds.length === 1 ? selectedAccountIds[0] : house.accounts[0]?.id || '';

    setInlineDraft((current) =>
      current?.mode === 'add'
        ? {
            ...current,
            insertIndex,
            day: String(preset?.day ?? current.day),
            month: String(preset?.month ?? current.month),
            kind: preset?.kind ?? current.kind,
            beforeId,
            afterId,
          }
        : {
            mode: 'add',
            insertIndex,
            name: '',
            amount: '',
            day: String(preset?.day ?? 1),
            month: String(preset?.month ?? 1),
            kind,
            accountId: defaultAccount,
            labelId: '',
            notes: '',
            beforeId,
            afterId,
          }
    );
  };

  const startInlineEdit = (item: CatalogRow) => {
    setInlineDraft({
      mode: 'edit',
      insertIndex: -1,
      itemId: item.id,
      previousKind: item.kind,
      name: item.name,
      amount: String(item.amount),
      day: String(item.day),
      month: String(item.month ?? 1),
      kind: item.kind,
      accountId: item.accountId,
      labelId: item.labelId || '',
      notes: item.notes || '',
    });
  };

  const saveInlineDraft = () => {
    if (!inlineDraft || !inlineDraft.name.trim()) return;

    const amountNum = parseFloat(inlineDraft.amount.replace(',', '.')) || 0;
    const dayNum = Math.min(Math.max(parseInt(inlineDraft.day, 10) || 1, 1), 31);
    const monthNum = Math.min(Math.max(parseInt(inlineDraft.month, 10) || 1, 1), 12);
    const accountId = inlineDraft.accountId || house.accounts[0]?.id || '';
    const labelId = inlineDraft.labelId || null;
    const notes = inlineDraft.notes.trim() || undefined;
    const amount = inlineDraft.kind === 'monthly_income' ? Math.abs(amountNum) : amountNum;

    onSaveItem(
      {
        id: inlineDraft.itemId || '',
        kind: inlineDraft.kind,
        name: inlineDraft.name.trim(),
        amount,
        day: dayNum,
        month: inlineDraft.kind === 'annual_expense' ? monthNum : undefined,
        accountId,
        labelId,
        notes,
        isActive: true,
      },
      inlineDraft.previousKind,
      inlineDraft.mode === 'add' && (inlineDraft.beforeId || inlineDraft.afterId)
        ? { beforeId: inlineDraft.beforeId, afterId: inlineDraft.afterId }
        : undefined,
      snapshotId
    );
    setInlineDraft(null);
  };

  const clearDragState = () => {
    setDraggingId(null);
    setDraggingDateKey(null);
    setDropHint(null);
  };

  const handleRowDragOver = (event: React.DragEvent<HTMLTableRowElement>, item: CatalogRow) => {
    if (!reorderEnabled || !draggingId || draggingDateKey === null) return;
    if (draggingId === item.id || catalogDateKey(item) !== draggingDateKey) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    const rect = event.currentTarget.getBoundingClientRect();
    const place = event.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
    setDropHint((current) =>
      current?.id === item.id && current.place === place ? current : { id: item.id, place }
    );
  };

  const handleRowDrop = (event: React.DragEvent<HTMLTableRowElement>, item: CatalogRow) => {
    event.preventDefault();
    if (!reorderEnabled) {
      clearDragState();
      return;
    }
    const fromId = event.dataTransfer.getData('text/plain') || draggingId;
    const place =
      dropHint?.id === item.id
        ? dropHint.place
        : event.clientY <
            event.currentTarget.getBoundingClientRect().top +
              event.currentTarget.getBoundingClientRect().height / 2
          ? 'before'
          : 'after';
    clearDragState();
    if (!fromId || fromId === item.id) return;
    const nextIds = orderedIdsAfterGroupedMove(
      catalogRows,
      fromId,
      item.id,
      place,
      catalogDateKey
    );
    if (nextIds) onReorderItems(nextIds, snapshotId);
  };

  const {
    totalMonthlyIncome,
    totalMonthlyExpense,
    totalYearlyExpense,
    totalMonthlyExpenseWithYearly,
    netMonthly,
    expenseToIncomePercent,
  } = useMemo(() => {
    let monthlyIncome = 0;
    let monthlyExpense = 0;
    let yearlyExpense = 0;
    for (const item of filteredItems) {
      if (item.kind === 'monthly_income') monthlyIncome += item.amount;
      else if (item.kind === 'monthly_expense') monthlyExpense += item.amount;
      else if (item.kind === 'annual_expense') yearlyExpense += item.amount;
    }
    const netMonthly = monthlyIncome - monthlyExpense;
    const yearlyAsMonthly = Math.round((yearlyExpense / 12) * 100) / 100;
    const monthlyExpenseWithYearly =
      Math.round((monthlyExpense + yearlyAsMonthly) * 100) / 100;
    const expenseToIncomePercent =
      monthlyIncome > 0
        ? Math.round((monthlyExpenseWithYearly / monthlyIncome) * 1000) / 10
        : null;
    return {
      totalMonthlyIncome: monthlyIncome,
      totalMonthlyExpense: monthlyExpense,
      totalYearlyExpense: yearlyExpense,
      totalMonthlyExpenseWithYearly: monthlyExpenseWithYearly,
      netMonthly,
      expenseToIncomePercent,
    };
  }, [filteredItems]);

  const kindOptions = CATALOG_KINDS.map((kind) => ({
    id: kind,
    label: `${t(CATALOG_KIND_LABEL_KEYS[kind])} (${kindScopedItems.filter((item) => item.kind === kind).length})`,
    color: CATALOG_KIND_META[kind].color,
  }));
  const accountOptions = house.accounts.map((account) => ({
    id: account.id,
    label: accountSelectLabel(account),
    color: account.color,
    variant: 'account' as const,
  }));
  const labelOptions = [
    ...house.labels.map((label) => ({
      id: label.id,
      label: label.name,
      color: label.color,
      variant: 'label' as const,
    })),
    { id: UNLABELED_ID, label: tc('unlabeled') },
  ];
  const filtersAreDefault =
    selectedKindIds.length === kindOptions.length &&
    selectedAccountIds.length === accountOptions.length &&
    selectedLabelIds.length === labelOptions.length;

  const handleSort = (key: CatalogSortKey) => {
    onViewStateChange?.(toggleCatalogSort(viewState, key));
  };

  const updateView = (patch: Partial<CatalogViewState>) => {
    onViewStateChange?.({ ...viewState, ...patch });
  };

  const resetFilters = () => {
    updateView({
      kindIds: kindOptions.map((option) => option.id),
      accountIds: accountOptions.map((option) => option.id),
      labelIds: labelOptions.map((option) => option.id),
    });
  };

  const editorOnChange = (patch: Partial<Omit<InlineDraft, 'insertIndex' | 'mode'>>) =>
    setInlineDraft((current) => (current ? { ...current, ...patch } : current));

  const renderEditor = (draft: InlineDraft, key: string) => (
    <InlineCatalogRow
      key={key}
      draft={draft}
      accounts={house.accounts}
      labels={house.labels}
      onChange={editorOnChange}
      onSave={saveInlineDraft}
      onCancel={() => setInlineDraft(null)}
    />
  );

  const inlineAddRow =
    inlineDraft?.mode === 'add' ? renderEditor(inlineDraft, 'inline-add') : null;

  const bodyRows: React.ReactNode[] = [];
  if (displayItems.length > 0) {
    displayItems.forEach((item, index) => {
      bodyRows.push(
        <InsertGapRow
          key={`insert-${index}`}
          columnCount={COLUMN_COUNT}
          inactive={Boolean(draggingId)}
          onAdd={() =>
            startInlineAdd(
              index,
              {
                day: index === 0 ? item.day : displayItems[index - 1].day,
                month: item.month,
                kind: item.kind,
              },
              displayItems[index]?.id,
              index > 0 ? displayItems[index - 1]?.id : undefined
            )
          }
        />
      );

      if (inlineDraft?.insertIndex === index && inlineAddRow) {
        bodyRows.push(inlineAddRow);
      }

      if (inlineDraft?.mode === 'edit' && inlineDraft.itemId === item.id) {
        bodyRows.push(renderEditor(inlineDraft, item.id));
      } else {
        const isDropTarget = dropHint?.id === item.id;
        const dropPlace = isDropTarget ? dropHint.place : null;
        bodyRows.push(
          <tr
            key={item.id}
            onDragOver={(event) => handleRowDragOver(event, item)}
            onDrop={(event) => handleRowDrop(event, item)}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                setDropHint((current) => (current?.id === item.id ? null : current));
              }
            }}
            className={`transition-colors group hover:bg-slate-50/60 ${
              draggingId === item.id ? 'opacity-50' : ''
            } ${
              dropPlace === 'before'
                ? 'shadow-[inset_0_2px_0_0_#2563eb]'
                : dropPlace === 'after'
                  ? 'shadow-[inset_0_-2px_0_0_#2563eb]'
                  : ''
            }`}
          >
            <td className={`${PLAN_CELL_HANDLE} border-slate-100 border-l-4 border-l-transparent`}>
              <OrderHandle
                enabled={reorderEnabled}
                onDragStart={(event) => {
                  event.dataTransfer.setData('text/plain', item.id);
                  event.dataTransfer.effectAllowed = 'move';
                  setDraggingId(item.id);
                  setDraggingDateKey(catalogDateKey(item));
                }}
                onDragEnd={clearDragState}
              />
            </td>
            <td className={`${PLAN_CELL} border-slate-100`}>
              <div className="flex flex-col justify-center gap-0.5 min-w-0 h-full">
                <div className="flex items-center gap-1.5 h-6 min-w-0">
                  <span className="font-semibold truncate min-w-0 flex-1 text-slate-900" title={item.name}>
                    {item.name}
                  </span>
                </div>
                {item.notes ? (
                  <div className="h-6 flex items-center min-w-0">
                    <span className="text-[11px] leading-none text-slate-400 truncate" title={item.notes}>
                      {item.notes}
                    </span>
                  </div>
                ) : null}
              </div>
            </td>
            <td className={`${PLAN_CELL} border-slate-100 text-center font-mono`}>
              <span className="inline-flex items-center justify-center h-6 min-w-6 px-2 rounded font-semibold bg-slate-200/70 text-slate-800">
                {formatCatalogDate(item.day, item.kind === 'annual_expense' ? item.month ?? 1 : null)}
              </span>
            </td>
            <td className={`${PLAN_CELL} border-slate-100 text-right font-mono font-semibold`}>
              <span className={catalogAmountClass(item)}>{formatCurrency(item.amount)}</span>
            </td>
            <td className={`${PLAN_CELL} border-slate-100`}>
              <KindBadge kind={item.kind} />
            </td>
            <td className={`${PLAN_CELL} border-slate-100`}>
              {item.labelName ? (
                <span
                  className="inline-flex max-w-full min-w-0 items-center gap-1 px-2 h-6 rounded-full text-[11px] font-medium text-white"
                  style={{ backgroundColor: item.labelColor || '#8b5cf6' }}
                  title={item.labelName}
                >
                  <Tag className="w-3 h-3 shrink-0" />
                  <span className="truncate">{item.labelName}</span>
                </span>
              ) : (
                <span className="text-[11px] text-slate-400">—</span>
              )}
            </td>
            <td className={`${PLAN_CELL} border-slate-100`}>
              <div className="flex items-center gap-1.5 min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: item.accountColor }}
                />
                <span className="font-medium text-slate-800 truncate" title={item.accountName}>
                  {item.accountName}
                </span>
              </div>
            </td>
            <td className={`${PLAN_CELL_ACTIONS} border-slate-100`}>
              <div className="flex items-center justify-end gap-1.5">
                <button
                  onClick={() => startInlineEdit(item)}
                  className="p-1 text-slate-400 hover:text-slate-800 rounded hover:bg-slate-100"
                  title={tc('editItem')}
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
                  <DeleteConfirmButton
                    onConfirm={() => onDeleteItem(item.id, snapshotId)}
                    title={tc('deleteItem')}
                  />
              </div>
            </td>
          </tr>
        );
      }
    });

    bodyRows.push(
      <InsertGapRow
        key="insert-end"
        columnCount={COLUMN_COUNT}
        inactive={Boolean(draggingId)}
        onAdd={() =>
          startInlineAdd(
            displayItems.length,
            {
              day: displayItems[displayItems.length - 1].day,
              month: displayItems[displayItems.length - 1].month,
              kind: displayItems[displayItems.length - 1].kind,
            },
            undefined,
            displayItems[displayItems.length - 1].id
          )
        }
      />
    );
    if (inlineDraft?.insertIndex === displayItems.length && inlineAddRow) {
      bodyRows.push(inlineAddRow);
    }
  } else if (inlineAddRow) {
    bodyRows.push(inlineAddRow);
  }

  const handleMobileDrop = (fromId: string, targetId: string, place: 'before' | 'after') => {
    const nextIds = orderedIdsAfterGroupedMove(catalogRows, fromId, targetId, place, catalogDateKey);
    if (nextIds) onReorderItems(nextIds, snapshotId);
  };

  const catalogSummary = (
    <div className="px-4 py-3 border-t-2 border-slate-200 bg-slate-50/90">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs">
        <div>
          <span className="text-slate-500">{t('monthlyIncome')}</span>{' '}
          <span className="font-bold font-mono text-emerald-700">
            +{formatCurrency(totalMonthlyIncome)}
          </span>
        </div>
        <div>
          <span className="text-slate-500">{t('monthlyExpense')}</span>{' '}
          <span className="font-bold font-mono text-rose-700">
            -{formatCurrency(totalMonthlyExpense)}
          </span>
        </div>
        <div>
          <span className="text-slate-500">{t('yearlyExpense')}</span>{' '}
          <span className="font-bold font-mono text-amber-800">
            {formatCurrency(totalYearlyExpense)}
          </span>
        </div>
        <div>
          <span className="text-slate-500">{t('monthlyWithYearly')}</span>{' '}
          <span
            className="font-bold font-mono text-rose-700"
            title={t('monthlyWithYearlyTitle')}
          >
            -{formatCurrency(totalMonthlyExpenseWithYearly)}
          </span>
        </div>
        <div>
          <span className="text-slate-500">{t('expenseIncomeRatio')}</span>{' '}
          <span
            className={`font-bold font-mono ${
              expenseToIncomePercent == null
                ? 'text-slate-400'
                : expenseToIncomePercent >= 100
                  ? 'text-rose-700'
                  : 'text-slate-800'
            }`}
            title={t('expenseIncomeRatioTitle')}
          >
            {formatExpenseIncomePercent(expenseToIncomePercent)}
          </span>
        </div>
        <div>
          <span className="text-slate-500">{t('monthlyBalance')}</span>{' '}
          <span
            className={`font-bold font-mono ${
              netMonthly >= 0 ? 'text-emerald-700' : 'text-rose-700'
            }`}
          >
            {formatSignedCurrency(netMonthly)}
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <>
    <div className="bg-white rounded-none lg:rounded-2xl border border-slate-200/90 border-x-0 lg:border-x shadow-sm overflow-hidden mb-4 lg:mb-6">
      <div className="px-4 py-4 lg:px-6 lg:py-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 lg:gap-4">
        <div className="flex items-center gap-2 min-w-0">
          <Table className="w-5 h-5 text-blue-600 shrink-0" />
          {typeof resolvedTitle === 'string' ? (
            <h3 className="text-lg font-semibold text-slate-900 truncate">{resolvedTitle}</h3>
          ) : (
            resolvedTitle
          )}
          {showInfoTooltip && (
            <span className="relative group inline-flex">
              <button
                type="button"
                className="text-slate-400 hover:text-blue-600 transition-colors"
                aria-label={t('infoAria')}
              >
                <Info className="w-4 h-4" />
              </button>
              <span
                role="tooltip"
                className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 w-80 -translate-x-1/2 rounded-lg bg-slate-900 px-3 py-2 text-xs leading-relaxed text-slate-100 opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
              >
                {t('info')}
              </span>
            </span>
          )}
        </div>
        {headerActions ? <div className="shrink-0">{headerActions}</div> : null}
      </div>

      <div className="px-4 lg:px-6 py-3 bg-slate-50/80 border-b border-slate-200/70 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-slate-500">{tc('show')}:</span>
        <MultiSelectFilter
          label={tc('type')}
          options={kindOptions}
          selectedIds={selectedKindIds}
          onChange={(kindIds) => updateView({ kindIds })}
          align="left"
          readOnly={filtersLocked}
        />
        <MultiSelectFilter
          label={tc('accounts')}
          options={accountOptions}
          selectedIds={selectedAccountIds}
          onChange={(accountIds) => updateView({ accountIds })}
          align="left"
          readOnly={filtersLocked}
        />
        <MultiSelectFilter
          label={tc('labels')}
          options={labelOptions}
          selectedIds={selectedLabelIds}
          onChange={(labelIds) => updateView({ labelIds })}
          readOnly={filtersLocked}
        />
        {!filtersLocked && (
          <button
            type="button"
            onClick={resetFilters}
            disabled={filtersAreDefault}
            title={tc('resetFilters')}
            className="ml-1 inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-md hover:bg-white border border-transparent hover:border-slate-200 transition-colors disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:border-transparent disabled:hover:text-slate-600"
          >
            <RotateCcw className="w-3 h-3" />
            {tc('reset')}
          </button>
        )}
      </div>

      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full min-w-[1100px] table-fixed text-left border-separate border-spacing-0">
          <colgroup>
            <col className="w-8" />
            <col />
            <col className="w-28" />
            <col className="w-32" />
            <col className="w-44" />
            <col className="w-40" />
            <col className="w-40" />
            <col className="w-24" />
          </colgroup>
          <thead>
            <tr className="bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              <th className="py-3 px-1 w-8 border-b border-slate-200" aria-label={tc('order')} />
              <SortableHeader
                label={tc('item')}
                column="name"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={filtersLocked ? undefined : handleSort}
              />
              <SortableHeader
                label={tc('day')}
                column="date"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={filtersLocked ? undefined : handleSort}
                align="center"
              />
              <SortableHeader
                label={tc('amount')}
                column="amount"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={filtersLocked ? undefined : handleSort}
                align="right"
              />
              <SortableHeader
                label={tc('type')}
                column="kind"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={filtersLocked ? undefined : handleSort}
              />
              <SortableHeader
                label={tc('label')}
                column="label"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={filtersLocked ? undefined : handleSort}
              />
              <SortableHeader
                label={tc('account')}
                column="account"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={filtersLocked ? undefined : handleSort}
              />
              <th className="py-3 px-4 text-right border-b border-slate-200 whitespace-nowrap">{tc('actions')}</th>
            </tr>
          </thead>
          <tbody className="text-xs text-slate-700">
            {displayItems.length === 0 && inlineDraft?.mode !== 'add' ? (
              <tr>
                <td colSpan={COLUMN_COUNT} className="py-12 text-center text-slate-400">
                  <div>{t('emptyFilter')}</div>
                  <button
                    type="button"
                    onClick={() => startInlineAdd(0)}
                    className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {tc('addItem')}
                  </button>
                </td>
              </tr>
            ) : (
              bodyRows
            )}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50/90">
              <td colSpan={COLUMN_COUNT} className="px-4 py-3 border-t-2 border-slate-200">
                <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs">
                  <div>
                    <span className="text-slate-500">{t('monthlyIncome')}</span>{' '}
                    <span className="font-bold font-mono text-emerald-700">
                      +{formatCurrency(totalMonthlyIncome)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">{t('monthlyExpense')}</span>{' '}
                    <span className="font-bold font-mono text-rose-700">
                      -{formatCurrency(totalMonthlyExpense)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">{t('yearlyExpense')}</span>{' '}
                    <span className="font-bold font-mono text-amber-800">
                      {formatCurrency(totalYearlyExpense)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">{t('monthlyWithYearly')}</span>{' '}
                    <span
                      className="font-bold font-mono text-rose-700"
                      title={t('monthlyWithYearlyTitle')}
                    >
                      -{formatCurrency(totalMonthlyExpenseWithYearly)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">{t('expenseIncomeRatio')}</span>{' '}
                    <span
                      className={`font-bold font-mono ${
                        expenseToIncomePercent == null
                          ? 'text-slate-400'
                          : expenseToIncomePercent >= 100
                            ? 'text-rose-700'
                            : 'text-slate-800'
                      }`}
                      title={t('expenseIncomeRatioTitle')}
                    >
                      {formatExpenseIncomePercent(expenseToIncomePercent)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">{t('monthlyBalance')}</span>{' '}
                    <span
                      className={`font-bold font-mono ${
                        netMonthly >= 0 ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {formatSignedCurrency(netMonthly)}
                    </span>
                  </div>
                </div>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="lg:hidden">
        {displayItems.length === 0 && inlineDraft?.mode !== 'add' ? (
          <div className="py-12 text-center text-slate-400 px-4">
            <div>{t('emptyFilter')}</div>
            <button
              type="button"
              onClick={() => startInlineAdd(0)}
              className="mt-3 inline-flex min-h-11 items-center gap-1.5 px-4 py-2 text-sm font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200"
            >
              <Plus className="w-4 h-4" />
              {tc('addItem')}
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {displayItems.map((item) => (
              <MobileRowCard
                key={item.id}
                id={item.id}
                onTap={() => startInlineEdit(item)}
                onEdit={() => startInlineEdit(item)}
                onDelete={() => onDeleteItem(item.id, snapshotId)}
                reorder={{
                  enabled: reorderEnabled,
                  groupKey: catalogDateKey(item),
                  onDropOn: (targetId, place) => handleMobileDrop(item.id, targetId, place),
                }}
              >
                <div className="px-4 py-3 flex flex-col gap-1.5 min-w-0">
                  <div className="flex items-start gap-2 min-w-0">
                    <span className="font-semibold truncate min-w-0 flex-1 text-slate-900" title={item.name}>
                      {item.name}
                    </span>
                    <span className={`shrink-0 font-mono font-semibold ${catalogAmountClass(item)}`}>
                      {formatCurrency(item.amount)}
                    </span>
                  </div>
                  {item.notes ? (
                    <span className="text-[11px] text-slate-400 truncate" title={item.notes}>
                      {item.notes}
                    </span>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center justify-center h-6 min-w-6 px-2 rounded font-semibold font-mono text-[11px] bg-slate-200/70 text-slate-800">
                      {formatCatalogDate(item.day, item.kind === 'annual_expense' ? item.month ?? 1 : null)}
                    </span>
                    <KindBadge kind={item.kind} />
                    {item.labelName ? (
                      <span
                        className="inline-flex max-w-full min-w-0 items-center gap-1 px-2 h-6 rounded-full text-[11px] font-medium text-white"
                        style={{ backgroundColor: item.labelColor || '#8b5cf6' }}
                      >
                        <Tag className="w-3 h-3 shrink-0" />
                        <span className="truncate">{item.labelName}</span>
                      </span>
                    ) : null}
                    <span className="inline-flex items-center gap-1.5 min-w-0 text-[11px] font-medium text-slate-800">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: item.accountColor }}
                      />
                      <span className="truncate">{item.accountName}</span>
                    </span>
                  </div>
                </div>
              </MobileRowCard>
            ))}
            <div className="px-4 py-3">
              <button
                type="button"
                onClick={() =>
                  startInlineAdd(
                    displayItems.length,
                    displayItems.length
                      ? {
                          day: displayItems[displayItems.length - 1].day,
                          month: displayItems[displayItems.length - 1].month,
                          kind: displayItems[displayItems.length - 1].kind,
                        }
                      : undefined,
                    undefined,
                    displayItems[displayItems.length - 1]?.id
                  )
                }
                className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 text-sm font-semibold text-blue-700"
              >
                <Plus className="w-4 h-4" />
                {tc('addItem')}
              </button>
            </div>
          </div>
        )}
        {catalogSummary}
      </div>
    </div>
    {inlineDraft ? (
      <CatalogMobileEditor
        draft={inlineDraft}
        accounts={house.accounts}
        labels={house.labels}
        onChange={editorOnChange}
        onSave={saveInlineDraft}
        onCancel={() => setInlineDraft(null)}
      />
    ) : null}
    </>
  );
};

function compareDisplayItems(
  a: CatalogRow,
  b: CatalogRow,
  key: CatalogSortKey,
  dir: CatalogViewState['sortDir'],
  indexOf: Map<string, number>,
  collator: Intl.Collator
): number {
  let result = 0;
  switch (key) {
    case 'name':
      result = collator.compare(a.name, b.name);
      break;
    case 'date':
      result = compareCatalogRows(a, b);
      break;
    case 'amount':
      result = a.amount - b.amount;
      break;
    case 'kind':
      result = CATALOG_KINDS.indexOf(a.kind) - CATALOG_KINDS.indexOf(b.kind);
      break;
    case 'label':
      result = collator.compare(a.labelName || '', b.labelName || '');
      break;
    case 'account':
      result = collator.compare(a.accountName, b.accountName);
      break;
  }

  if (result === 0 && key !== 'date') {
    return (indexOf.get(a.id) ?? 0) - (indexOf.get(b.id) ?? 0);
  }
  if (key === 'date') {
    return dir === 'asc' ? result : -compareCatalogRows(a, b);
  }
  return dir === 'asc' ? result : -result;
}

function KindBadge({ kind }: { kind: CatalogKind }) {
  const t = useTranslations('catalog');
  const meta = CATALOG_KIND_META[kind];
  return (
    <span className={`inline-flex max-w-full min-w-0 items-center h-6 px-2 rounded font-medium ${meta.badgeClassName}`}>
      <span className="truncate">{t(CATALOG_KIND_LABEL_KEYS[kind])}</span>
    </span>
  );
}

function catalogAmountClass(item: CatalogRow): string {
  if (item.kind === 'monthly_income') return 'whitespace-nowrap text-emerald-700 font-bold';
  if (item.amount < 0) return 'whitespace-nowrap text-indigo-600';
  return 'whitespace-nowrap text-rose-700';
}

function catalogKindSelectOptions(t: ReturnType<typeof useTranslations<'catalog'>>) {
  return CATALOG_KINDS.map((kind) => ({
    value: kind,
    label: t(CATALOG_KIND_LABEL_KEYS[kind]),
    variant: 'badge' as const,
    badgeClassName: CATALOG_KIND_META[kind].badgeClassName,
  }));
}

function InlineCatalogRow({
  draft,
  accounts,
  labels,
  onChange,
  onSave,
  onCancel,
}: {
  draft: InlineDraft;
  accounts: House['accounts'];
  labels: House['labels'];
  onChange: (patch: Partial<Omit<InlineDraft, 'insertIndex' | 'mode'>>) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations('catalog');
  const tc = useTranslations('common');
  const { accountSelectLabel } = useBudgetFormat();
  const kindSelectOptions = catalogKindSelectOptions(t);
  const nameRef = useRef<HTMLInputElement>(null);
  const selectedLabel = labels.find((label) => label.id === draft.labelId);
  const effectiveAccountId = selectedLabel?.accountId || draft.accountId;
  const accountLocked = Boolean(selectedLabel);
  const annual = draft.kind === 'annual_expense';

  useEffect(() => {
    if (nameRef.current && nameRef.current.offsetParent !== null) {
      nameRef.current.focus();
    }
  }, []);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onCancel();
      return;
    }
    if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
      if (
        event.target instanceof HTMLSelectElement ||
        (event.target instanceof HTMLElement && event.target.closest('[data-inline-select]'))
      ) {
        return;
      }
      event.preventDefault();
      onSave();
    }
  };

  return (
    <tr className="bg-blue-50/70" onKeyDown={handleKeyDown}>
      <td className={`${PLAN_CELL_HANDLE} border-blue-200 border-l-4 border-l-blue-600`} />
      <td className={`${PLAN_CELL} border-blue-200`}>
        <div className="flex flex-col justify-center gap-0.5 min-w-0 h-full">
          <input
            ref={nameRef}
            type="text"
            required
            value={draft.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder={tc('itemNamePlaceholder')}
            className={INLINE_INPUT_CLASS}
          />
          <input
            type="text"
            value={draft.notes}
            onChange={(e) => onChange({ notes: e.target.value })}
            placeholder={tc('notesPlaceholder')}
            className={INLINE_INPUT_CLASS}
          />
        </div>
      </td>
      <td className={`${PLAN_CELL} border-blue-200 text-center`}>
        <div className="flex items-center justify-center gap-0.5 font-mono text-xs text-slate-700">
          <input
            type="number"
            min={1}
            max={31}
            value={draft.day}
            onChange={(e) => onChange({ day: e.target.value })}
            className={`${INLINE_NUMBER_CLASS} w-10 text-center px-1`}
            aria-label={tc('day')}
          />
          <span>.</span>
          {annual ? (
            <>
              <input
                type="number"
                min={1}
                max={12}
                value={draft.month}
                onChange={(e) => onChange({ month: e.target.value })}
                className={`${INLINE_NUMBER_CLASS} w-10 text-center px-1`}
                aria-label={tc('month')}
              />
              <span>.</span>
            </>
          ) : (
            <span className="text-slate-500">*</span>
          )}
        </div>
      </td>
      <td className={`${PLAN_CELL} border-blue-200 text-right`}>
        <input
          type="number"
          step="0.01"
          value={draft.amount}
          onChange={(e) => onChange({ amount: e.target.value })}
          placeholder="0,00"
          title={
            draft.kind === 'monthly_income'
              ? t('incomeAmount')
              : t('expenseAmountHint')
          }
          className={`${INLINE_NUMBER_CLASS} text-right font-mono`}
          aria-label={tc('amount')}
        />
      </td>
      <td className={`${PLAN_CELL} border-blue-200`}>
        <InlineSelect
          value={draft.kind}
          onChange={(kind) => onChange({ kind: kind as CatalogKind })}
          aria-label={t('itemType')}
          options={kindSelectOptions}
        />
      </td>
      <td className={`${PLAN_CELL} border-blue-200`}>
        <InlineSelect
          value={draft.labelId}
          onChange={(nextLabelId) => {
            const nextLabel = labels.find((label) => label.id === nextLabelId);
            onChange({
              labelId: nextLabelId,
              accountId: nextLabel?.accountId || draft.accountId || accounts[0]?.id || '',
            });
          }}
          aria-label={tc('label')}
          options={[
            { value: '', label: tc('unlabeled') },
            ...accounts.flatMap((acc) =>
              labels
                .filter((label) => label.accountId === acc.id)
                .map((lbl) => ({
                  value: lbl.id,
                  label: lbl.name,
                  color: lbl.color,
                  variant: 'label' as const,
                  group: accountSelectLabel(acc),
                  groupColor: acc.color,
                }))
            ),
          ]}
        />
      </td>
      <td className={`${PLAN_CELL} border-blue-200`}>
        <InlineSelect
          value={effectiveAccountId}
          disabled={accountLocked}
          onChange={(accountId) => onChange({ accountId })}
          aria-label={tc('account')}
          title={accountLocked ? tc('accountFromLabel') : undefined}
          options={accounts.map((acc) => ({
            value: acc.id,
            label: accountSelectLabel(acc),
            color: acc.color,
            variant: 'account' as const,
          }))}
        />
      </td>
      <td className={`${PLAN_CELL_ACTIONS} border-blue-200`}>
        <div className="flex items-center justify-end gap-1.5">
          <button
            type="button"
            onClick={onSave}
            className="p-1 text-white bg-blue-600 hover:bg-blue-500 rounded"
            title={tc('saveItem')}
          >
            <Check className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="p-1 text-slate-400 hover:text-slate-800 rounded hover:bg-white"
            title={tc('cancel')}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}

function CatalogMobileEditor({
  draft,
  accounts,
  labels,
  onChange,
  onSave,
  onCancel,
}: {
  draft: InlineDraft;
  accounts: House['accounts'];
  labels: House['labels'];
  onChange: (patch: Partial<Omit<InlineDraft, 'insertIndex' | 'mode'>>) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations('catalog');
  const tc = useTranslations('common');
  const { accountSelectLabel } = useBudgetFormat();
  const kindSelectOptions = catalogKindSelectOptions(t);
  const selectedLabel = labels.find((label) => label.id === draft.labelId);
  const effectiveAccountId = selectedLabel?.accountId || draft.accountId;
  const accountLocked = Boolean(selectedLabel);
  const annual = draft.kind === 'annual_expense';

  return (
    <MobileEditorSheet
      open
      title={draft.mode === 'add' ? tc('newItem') : tc('editItem')}
      onSave={onSave}
      onCancel={onCancel}
    >
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-600">{tc('itemName')}</span>
        <input
          type="text"
          required
          autoFocus
          value={draft.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder={tc('itemNamePlaceholder')}
          className={MOBILE_INPUT_CLASS}
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-600">{tc('notes')}</span>
        <input
          type="text"
          value={draft.notes}
          onChange={(e) => onChange({ notes: e.target.value })}
          placeholder={tc('notesPlaceholder')}
          className={MOBILE_INPUT_CLASS}
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">{tc('day')}</span>
          <div className="flex items-center gap-1 font-mono">
            <input
              type="number"
              min={1}
              max={31}
              value={draft.day}
              onChange={(e) => onChange({ day: e.target.value })}
              className={`${MOBILE_NUMBER_CLASS} text-center`}
              aria-label={tc('day')}
            />
            {annual ? (
              <input
                type="number"
                min={1}
                max={12}
                value={draft.month}
                onChange={(e) => onChange({ month: e.target.value })}
                className={`${MOBILE_NUMBER_CLASS} text-center`}
                aria-label={tc('month')}
              />
            ) : (
              <span className="text-slate-500 text-sm">.*</span>
            )}
          </div>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">{tc('amount')}</span>
          <input
            type="number"
            step="0.01"
            value={draft.amount}
            onChange={(e) => onChange({ amount: e.target.value })}
            placeholder="0,00"
            className={`${MOBILE_NUMBER_CLASS} text-right font-mono`}
          />
        </label>
      </div>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-600">{tc('type')}</span>
        <InlineSelect
          size="mobile"
          value={draft.kind}
          onChange={(kind) => onChange({ kind: kind as CatalogKind })}
          aria-label={t('itemType')}
          options={kindSelectOptions}
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-600">{tc('label')}</span>
        <InlineSelect
          size="mobile"
          value={draft.labelId}
          onChange={(nextLabelId) => {
            const nextLabel = labels.find((label) => label.id === nextLabelId);
            onChange({
              labelId: nextLabelId,
              accountId: nextLabel?.accountId || draft.accountId || accounts[0]?.id || '',
            });
          }}
          aria-label={tc('label')}
          options={[
            { value: '', label: tc('unlabeled') },
            ...accounts.flatMap((acc) =>
              labels
                .filter((label) => label.accountId === acc.id)
                .map((lbl) => ({
                  value: lbl.id,
                  label: lbl.name,
                  color: lbl.color,
                  variant: 'label' as const,
                  group: accountSelectLabel(acc),
                  groupColor: acc.color,
                }))
            ),
          ]}
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-600">{tc('account')}</span>
        <InlineSelect
          size="mobile"
          value={effectiveAccountId}
          disabled={accountLocked}
          onChange={(accountId) => onChange({ accountId })}
          aria-label={tc('account')}
          title={accountLocked ? tc('accountFromLabel') : undefined}
          options={accounts.map((acc) => ({
            value: acc.id,
            label: accountSelectLabel(acc),
            color: acc.color,
            variant: 'account' as const,
          }))}
        />
      </label>
    </MobileEditorSheet>
  );
}
