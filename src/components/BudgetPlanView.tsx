'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useBudgetFormat } from '../i18n/useBudgetFormat';
import {
  BankAccount,
  BudgetItemOverride,
  House,
  ItemLabel,
  ResolvedBudgetItem,
} from '../types';
import { parseMonthKey } from '../utils/formatters';
import { computeAccountRunningBalances, isOpeningCorrectionId, orderedIdsAfterMove, visibleAccounts } from '../utils/budgetLogic';
import type { AccountOpeningBalance } from '../utils/budgetLogic';
import {
  Calendar,
  Check,
  Plus,
  RotateCcw,
  CheckCircle2,
  Circle,
  Edit3,
  Tag,
  Info,
  Sliders,
  X,
} from 'lucide-react';
import { MultiSelectFilter } from './MultiSelectFilter';
import { MonthYearPicker } from './MonthYearPicker';
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
  type SortDir,
} from './BudgetTableUi';
import { MobileEditorSheet } from './MobileEditorSheet';
import { MobileRowCard } from './MobileRowCard';

const UNLABELED_ID = '__unlabeled__';
const COLUMN_COUNT = 10;

const SOURCE_RANK: Record<ResolvedBudgetItem['sourceType'], number> = {
  opening_correction: -1,
  synced_income: 0,
  synced_monthly_expense: 1,
  synced_annual_expense: 2,
  custom_item: 3,
};

type SortKey = 'status' | 'name' | 'day' | 'amount' | 'source' | 'label' | 'account';

interface InlineDraft {
  mode: 'add' | 'edit';
  insertIndex: number;
  itemId?: string;
  isCustom?: boolean;
  originalItemId?: string;
  isPaid?: boolean;
  sourceType?: ResolvedBudgetItem['sourceType'];
  name: string;
  amount: string;
  day: string;
  accountId: string;
  labelId: string;
  notes: string;
  beforeId?: string;
  afterId?: string;
}

const TYPE_FILTER_IDS = ['income', 'expense'] as const;

interface BudgetPlanViewProps {
  house: House;
  monthKey: string;
  todayMonthKey: string;
  onChangeMonth: (newMonthKey: string) => void;
  currentDay: number;
  resolvedItems: ResolvedBudgetItem[];
  onSetOverride: (originalItemId: string, override: Partial<BudgetItemOverride>) => void;
  onClearOverride: (originalItemId: string) => void;
  onAddCustomItem: (
    customItem: Omit<BudgetItemOverride, 'id' | 'isCustom'>,
    placement?: { beforeId?: string; afterId?: string }
  ) => void;
  onUpdateCustomItem: (customItem: BudgetItemOverride) => void;
  onDeleteCustomItem: (customItemId: string) => void;
  onToggleSettled: (itemId: string, settled: boolean) => void;
  onReorderItems: (orderedItemIds: string[]) => void;
  openingBalances: Record<string, AccountOpeningBalance>;
  onSetOpeningBalance: (accountId: string, amount: number | null) => void;
}

export const BudgetPlanView: React.FC<BudgetPlanViewProps> = ({
  house,
  monthKey,
  todayMonthKey,
  onChangeMonth,
  currentDay,
  resolvedItems,
  onSetOverride,
  onClearOverride,
  onAddCustomItem,
  onUpdateCustomItem,
  onDeleteCustomItem,
  onToggleSettled,
  onReorderItems,
  openingBalances,
  onSetOpeningBalance,
}) => {
  const t = useTranslations('plan');
  const tc = useTranslations('common');
  const tCashflow = useTranslations('cashflow');
  const { formatCurrency, formatSignedCurrency, getMonthName, accountSelectLabel, collator } =
    useBudgetFormat();
  const { year, month } = parseMonthKey(monthKey);
  const isCurrentMonth = monthKey === todayMonthKey;

  const [selectedTypeIds, setSelectedTypeIds] = useState<string[]>(() => [...TYPE_FILTER_IDS]);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>(() =>
    visibleAccounts(house.accounts).map((account) => account.id)
  );
  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>(() => [
    ...house.labels.map((label) => label.id),
    UNLABELED_ID,
  ]);
  const [sortKey, setSortKey] = useState<SortKey>('day');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [inlineDraft, setInlineDraft] = useState<InlineDraft | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [draggingDay, setDraggingDay] = useState<number | null>(null);
  const [dropHint, setDropHint] = useState<{ id: string; place: 'before' | 'after' } | null>(null);

  useEffect(() => {
    setSelectedAccountIds(visibleAccounts(house.accounts).map((account) => account.id));
    setSelectedLabelIds([...house.labels.map((label) => label.id), UNLABELED_ID]);
  }, [house.id]);

  const handleCurrentMonth = () => {
    onChangeMonth(todayMonthKey);
  };

  const startInlineAdd = (insertIndex: number, presetDay?: number, beforeId?: string, afterId?: string) => {
    const defaultDay = Math.min(isCurrentMonth ? currentDay : 1, 28);
    const nextDay = String(presetDay ?? defaultDay);
    const defaultAccount =
      selectedAccountIds.length === 1 ? selectedAccountIds[0] : house.accounts[0]?.id || '';

    setInlineDraft((current) =>
      current?.mode === 'add'
        ? { ...current, insertIndex, day: nextDay, beforeId, afterId }
        : {
            mode: 'add',
            insertIndex,
            name: '',
            amount: '',
            day: nextDay,
            accountId: defaultAccount,
            labelId: '',
            notes: '',
            beforeId,
            afterId,
          }
    );
  };

  const startInlineEdit = (item: ResolvedBudgetItem) => {
    const signedAmount = item.type === 'income' ? item.amount : -item.amount;
    setInlineDraft({
      mode: 'edit',
      insertIndex: -1,
      itemId: item.id,
      isCustom: item.isCustom,
      originalItemId: item.originalItemId,
      isPaid: item.isPaid,
      sourceType: item.sourceType,
      name: item.name,
      amount: String(signedAmount),
      day: String(item.day),
      accountId: item.accountId,
      labelId: item.labelId || '',
      notes: item.notes || '',
    });
  };

  const saveInlineDraft = () => {
    if (!inlineDraft || !inlineDraft.name.trim()) return;

    const amountNum = parseFloat(inlineDraft.amount.replace(',', '.')) || 0;
    const dayNum = Math.min(Math.max(parseInt(inlineDraft.day, 10) || 1, 1), 31);
    const type = amountNum > 0 ? 'income' : 'expense';
    const amount = Math.abs(amountNum);
    const accountId = inlineDraft.accountId || house.accounts[0]?.id || '';
    const labelId = inlineDraft.labelId || null;
    const notes = inlineDraft.notes.trim() || undefined;

    if (inlineDraft.mode === 'edit') {
      if (inlineDraft.isCustom && inlineDraft.itemId) {
        onUpdateCustomItem({
          id: inlineDraft.itemId,
          isCustom: true,
          name: inlineDraft.name.trim(),
          amount,
          day: dayNum,
          type,
          accountId,
          labelId,
          notes,
          isPaid: inlineDraft.isPaid,
        });
      } else if (inlineDraft.originalItemId) {
        onSetOverride(inlineDraft.originalItemId, {
          name: inlineDraft.name.trim(),
          amount,
          day: dayNum,
          type,
          accountId,
          labelId,
          notes,
        });
      }
    } else {
      onAddCustomItem(
        {
          name: inlineDraft.name.trim(),
          amount,
          day: dayNum,
          type,
          accountId,
          labelId,
          notes,
          isPaid: false,
        },
        inlineDraft.beforeId || inlineDraft.afterId
          ? { beforeId: inlineDraft.beforeId, afterId: inlineDraft.afterId }
          : undefined
      );
    }
    setInlineDraft(null);
  };

  const knownLabelIds = useMemo(
    () => new Set(house.labels.map((label) => label.id)),
    [house.labels]
  );

  const matchesAccount = (item: ResolvedBudgetItem) => selectedAccountIds.includes(item.accountId);
  const matchesLabel = (item: ResolvedBudgetItem) => {
    const labelFilterId =
      item.labelId && knownLabelIds.has(item.labelId) ? item.labelId : UNLABELED_ID;
    return selectedLabelIds.includes(labelFilterId);
  };

  const runningBalances = useMemo(() => {
    const carried: Record<string, number> = {};
    for (const [accountId, opening] of Object.entries(openingBalances)) {
      carried[accountId] = opening.carried;
    }
    return computeAccountRunningBalances(resolvedItems, carried);
  }, [resolvedItems, openingBalances]);

  const canonicalIndex = useMemo(() => {
    const indexById = new Map<string, number>();
    resolvedItems.forEach((item, index) => {
      indexById.set(item.id, index);
    });
    return indexById;
  }, [resolvedItems]);

  const accountEndBalances = useMemo(() => {
    const ends: Record<string, number> = {};
    resolvedItems.forEach((item) => {
      ends[item.accountId] = runningBalances[item.id] ?? 0;
    });
    return ends;
  }, [resolvedItems, runningBalances]);

  const typeScopedItems = resolvedItems.filter(
    (item) => matchesAccount(item) && matchesLabel(item)
  );

  const filteredItems = typeScopedItems.filter((item) => selectedTypeIds.includes(item.type));

  const displayItems = useMemo(() => {
    const sorted = [...filteredItems];
    sorted.sort((a, b) => compareItems(a, b, sortKey, sortDir, canonicalIndex, collator));
    return sorted;
  }, [filteredItems, sortKey, sortDir, canonicalIndex, collator]);

  const isChronologicalSort = sortKey === 'day' && sortDir === 'asc';
  const reorderEnabled = isChronologicalSort && !inlineDraft;

  const clearDragState = () => {
    setDraggingId(null);
    setDraggingDay(null);
    setDropHint(null);
  };

  const handleRowDragOver = (
    event: React.DragEvent<HTMLTableRowElement>,
    item: ResolvedBudgetItem
  ) => {
    if (!reorderEnabled || !draggingId || draggingDay === null) return;
    if (draggingId === item.id || item.day !== draggingDay) return;
    if (item.sourceType === 'opening_correction') return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    const rect = event.currentTarget.getBoundingClientRect();
    const place = event.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
    setDropHint((current) =>
      current?.id === item.id && current.place === place ? current : { id: item.id, place }
    );
  };

  const handleRowDrop = (event: React.DragEvent<HTMLTableRowElement>, item: ResolvedBudgetItem) => {
    event.preventDefault();
    if (!reorderEnabled) {
      clearDragState();
      return;
    }
    const fromId = event.dataTransfer.getData('text/plain') || draggingId;
    const place =
      dropHint?.id === item.id
        ? dropHint.place
        : event.clientY < event.currentTarget.getBoundingClientRect().top +
            event.currentTarget.getBoundingClientRect().height / 2
          ? 'before'
          : 'after';
    clearDragState();
    if (!fromId || fromId === item.id || item.sourceType === 'opening_correction') return;
    const nextIds = orderedIdsAfterMove(resolvedItems, fromId, item.id, place);
    if (nextIds) onReorderItems(nextIds.filter((id) => !isOpeningCorrectionId(id)));
  };

  const plannedItems = filteredItems.filter((item) => item.sourceType !== 'opening_correction');
  const totalIncome = plannedItems
    .filter((item) => item.type === 'income')
    .reduce((sum, item) => sum + item.amount, 0);
  const totalExpense = plannedItems
    .filter((item) => item.type === 'expense')
    .reduce((sum, item) => sum + item.amount, 0);
  const netBalance = totalIncome - totalExpense;

  const footerAccounts = house.accounts.filter((account) =>
    filteredItems.some((item) => item.accountId === account.id)
  );

  const typeOptions = [
    {
      id: 'income',
      label: t('incomeCount', {
        count: typeScopedItems.filter((item) => item.type === 'income').length,
      }),
      color: '#34d399',
    },
    {
      id: 'expense',
      label: t('expenseCount', {
        count: typeScopedItems.filter((item) => item.type === 'expense').length,
      }),
      color: '#fb7185',
    },
  ];
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

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDir('asc');
  };

  const lastPastOrTodayIndex =
    isChronologicalSort && isCurrentMonth
      ? displayItems.reduce((acc, item, index) => (item.day <= currentDay ? index : acc), -1)
      : -1;

  const editorOnChange = (patch: Partial<Omit<InlineDraft, 'insertIndex' | 'mode'>>) =>
    setInlineDraft((current) => (current ? { ...current, ...patch } : current));

  const renderEditor = (draft: InlineDraft, key: string) => (
    <InlineAddRow
      key={key}
      draft={draft}
      accounts={house.accounts}
      labels={house.labels}
      monthName={getMonthName(month)}
      sourceType={draft.sourceType ?? 'custom_item'}
      isPaid={draft.isPaid ?? false}
      onChange={editorOnChange}
      onSave={saveInlineDraft}
      onCancel={() => setInlineDraft(null)}
    />
  );

  const inlineAddRow =
    inlineDraft?.mode === 'add' ? renderEditor(inlineDraft, 'inline-add') : null;

  const bodyRows: React.ReactNode[] = [];
  if (displayItems.length > 0) {
    if (isChronologicalSort && isCurrentMonth && lastPastOrTodayIndex === -1) {
      bodyRows.push(
        <TodayDividerRow
          key="today-divider"
          day={currentDay}
          monthName={getMonthName(month)}
        />
      );
    }

    displayItems.forEach((item, index) => {
      const isCorrection = item.sourceType === 'opening_correction';
      const prev = index > 0 ? displayItems[index - 1] : undefined;
      if (!isCorrection) {
        const insertDay = !prev || prev.sourceType === 'opening_correction' ? item.day : prev.day;
        const afterId = prev && prev.sourceType !== 'opening_correction' ? prev.id : undefined;
        bodyRows.push(
          <InsertGapRow
            key={`insert-${index}`}
            columnCount={COLUMN_COUNT}
            inactive={Boolean(draggingId)}
            onAdd={() => startInlineAdd(index, insertDay, item.id, afterId)}
          />
        );
      }

      if (inlineDraft?.insertIndex === index && inlineAddRow) {
        bodyRows.push(inlineAddRow);
      }

      const isTodayItem = isCurrentMonth && item.day === currentDay;
      const balance = runningBalances[item.id];

      if (!isCorrection && inlineDraft?.mode === 'edit' && inlineDraft.itemId === item.id) {
        bodyRows.push(renderEditor(inlineDraft, item.id));
      } else {
      const isDropTarget = dropHint?.id === item.id;
      const dropPlace = isDropTarget ? dropHint.place : null;
      bodyRows.push(
        <tr
          key={item.id}
          title={
            isCorrection
              ? t('openingCorrection')
              : item.isCustom
                ? t('customMonthItem')
                : undefined
          }
          onDragOver={isCorrection ? undefined : (event) => handleRowDragOver(event, item)}
          onDrop={isCorrection ? undefined : (event) => handleRowDrop(event, item)}
          onDragLeave={
            isCorrection
              ? undefined
              : (event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                    setDropHint((current) => (current?.id === item.id ? null : current));
                  }
                }
          }
          className={`${planItemRowClassName(item, isTodayItem)} ${
            draggingId === item.id ? 'opacity-50' : ''
          } ${
            dropPlace === 'before'
              ? 'shadow-[inset_0_2px_0_0_#2563eb]'
              : dropPlace === 'after'
                ? 'shadow-[inset_0_-2px_0_0_#2563eb]'
                : ''
          }`}
        >
          <td
            className={`${PLAN_CELL_HANDLE} border-slate-100 ${planItemAccentClass(item, isTodayItem)}`}
          >
            <OrderHandle
              enabled={reorderEnabled && !isCorrection}
              onDragStart={(event) => {
                event.dataTransfer.setData('text/plain', item.id);
                event.dataTransfer.effectAllowed = 'move';
                setDraggingId(item.id);
                setDraggingDay(item.day);
              }}
              onDragEnd={clearDragState}
            />
          </td>
          <td className={`${PLAN_CELL} border-slate-100 text-center`}>
            {isCorrection ? (
              <span className="text-slate-300">—</span>
            ) : (
              <button
                onClick={() => onToggleSettled(item.id, !item.isPaid)}
                className="text-slate-400 hover:text-blue-600 transition-colors"
                title={item.isPaid ? t('markUnpaid') : t('markPaid')}
              >
                {item.isPaid ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 inline" />
                ) : (
                  <Circle className="w-4 h-4 inline" />
                )}
              </button>
            )}
          </td>

          <td className={`${PLAN_CELL} border-slate-100`}>
            <div className="flex flex-col justify-center gap-0.5 min-w-0 h-full">
              <div className="flex items-center gap-1.5 h-6 min-w-0">
                <span
                  className={`font-semibold truncate min-w-0 flex-1 ${
                    item.isPaid ? 'line-through text-slate-500' : 'text-slate-900'
                  }`}
                  title={item.name}
                >
                  {item.name}
                </span>
                {item.isOverridden && (
                  <span className="shrink-0 text-[10px] leading-none bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-semibold border border-amber-300">
                    {t('overridden')}
                  </span>
                )}
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
            <span
              className={`inline-flex items-center justify-center h-6 min-w-6 px-2 rounded font-semibold ${
                isTodayItem
                  ? 'bg-blue-600 text-white'
                  : isCurrentMonth && item.day < currentDay
                    ? 'bg-slate-100 text-slate-600'
                    : 'bg-slate-200/70 text-slate-800'
              }`}
            >
              {item.day}.
            </span>
          </td>

          <td className={`${PLAN_CELL} border-slate-100 text-right font-mono font-semibold`}>
            <div className="flex flex-col items-end justify-center leading-tight min-w-0">
              <span className={itemAmountClass(item)}>
                {formatCurrency(item.amount)}
              </span>
              {item.isOverridden && item.originalAmount !== undefined && (
                <span
                  className="text-[10px] text-slate-400 line-through whitespace-nowrap"
                  title={t('originalAmount', { amount: formatCurrency(item.originalAmount) })}
                >
                  {formatCurrency(item.originalAmount)}
                </span>
              )}
            </div>
          </td>

          <td
            className={`${PLAN_CELL} border-slate-100 text-right font-mono whitespace-nowrap ${
              balance !== undefined && balance < 0
                ? 'text-rose-700 font-semibold'
                : isChronologicalSort
                  ? 'text-slate-800 font-semibold'
                  : 'text-slate-400 italic'
            }`}
            title={
              isChronologicalSort
                ? t('balanceAfterItem', { account: item.accountName })
                : t('balanceAlwaysChronological')
            }
          >
            {balance === undefined ? '—' : formatCurrency(balance)}
          </td>

          <td className={`${PLAN_CELL} border-slate-100`}>
            <SourceBadge sourceType={item.sourceType} monthName={getMonthName(month)} />
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
              {isCorrection ? null : (
                <>
              <button
                onClick={() => startInlineEdit(item)}
                className="p-1 text-slate-400 hover:text-slate-800 rounded hover:bg-slate-100"
                title={
                  item.isCustom ? tc('editItem') : t('overrideSynced')
                }
              >
                {item.isCustom ? (
                  <Edit3 className="w-3.5 h-3.5" />
                ) : (
                  <Sliders className="w-3.5 h-3.5" />
                )}
              </button>
              {item.isCustom ? (
                <DeleteConfirmButton
                  onConfirm={() => onDeleteCustomItem(item.id)}
                  title={t('removeFromMonth')}
                />
              ) : (
                item.isOverridden &&
                item.originalItemId && (
                  <button
                    onClick={() => onClearOverride(item.originalItemId!)}
                    className="p-1 text-amber-600 hover:text-amber-800 rounded hover:bg-amber-100"
                    title={t('restoreSync')}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )
              )}
                </>
              )}
            </div>
          </td>
        </tr>
      );
      }

      if (index === lastPastOrTodayIndex) {
        bodyRows.push(
          <TodayDividerRow
            key="today-divider"
            day={currentDay}
            monthName={getMonthName(month)}
          />
        );
      }
    });

    const lastRealItem = [...displayItems]
      .reverse()
      .find((item) => item.sourceType !== 'opening_correction');
    bodyRows.push(
      <InsertGapRow
        key="insert-end"
        columnCount={COLUMN_COUNT}
        inactive={Boolean(draggingId)}
        onAdd={() =>
          startInlineAdd(
            displayItems.length,
            lastRealItem?.day ?? 1,
            undefined,
            lastRealItem?.id
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

  const renderMobileEditor = (draft: InlineDraft) => (
    <PlanMobileEditor
      draft={draft}
      accounts={house.accounts}
      labels={house.labels}
      monthName={getMonthName(month)}
      sourceType={draft.sourceType ?? 'custom_item'}
      isPaid={draft.isPaid ?? false}
      onChange={editorOnChange}
      onSave={saveInlineDraft}
      onCancel={() => setInlineDraft(null)}
    />
  );

  const handleMobileDrop = (fromId: string, targetId: string, place: 'before' | 'after') => {
    const nextIds = orderedIdsAfterMove(resolvedItems, fromId, targetId, place);
    if (nextIds) onReorderItems(nextIds.filter((id) => !isOpeningCorrectionId(id)));
  };

  const planSummary = (
    <div className="px-4 py-3 border-t-2 border-slate-200 bg-slate-50/90">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs">
        <div>
          <span className="text-slate-500">{t('plannedIncome')}</span>{' '}
          <span className="font-bold font-mono text-emerald-700">
            +{formatCurrency(totalIncome)}
          </span>
        </div>
        <div>
          <span className="text-slate-500">{t('plannedExpense')}</span>{' '}
          <span className="font-bold font-mono text-rose-700">
            -{formatCurrency(totalExpense)}
          </span>
        </div>
        <div>
          <span className="text-slate-500">{t('netBalance')}</span>{' '}
          <span
            className={`font-bold font-mono ${
              netBalance >= 0 ? 'text-emerald-700' : 'text-rose-700'
            }`}
          >
            {formatSignedCurrency(netBalance)}
          </span>
        </div>
      </div>
      {footerAccounts.length > 0 && (
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-medium text-slate-500">
            {t('accountBalancesMonth')}
          </span>
          {footerAccounts.map((account) => (
            <span
              key={account.id}
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[11px] font-medium text-slate-800"
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: account.color }} />
              <span>{account.name}</span>
              <span className="font-mono font-semibold">
                {formatCurrency(accountEndBalances[account.id] ?? 0)}
              </span>
            </span>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <>
    <div className="bg-white rounded-none lg:rounded-2xl border border-slate-200/90 border-x-0 lg:border-x shadow-sm overflow-hidden mb-4 lg:mb-6">
      <div className="px-4 py-4 lg:px-6 lg:py-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 lg:gap-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-slate-900">
            {t('title', { month: getMonthName(month), year })}
          </h3>
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
              className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 w-72 -translate-x-1/2 rounded-lg bg-slate-900 px-3 py-2 text-xs leading-relaxed text-slate-100 opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
            >
              {t('info')}
            </span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <MonthYearPicker
            monthKey={monthKey}
            todayMonthKey={todayMonthKey}
            onChange={onChangeMonth}
          />

          <button
            onClick={handleCurrentMonth}
            disabled={isCurrentMonth}
            title={tCashflow('goToCurrentMonth')}
            className="px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200/60 transition-colors disabled:opacity-50 disabled:hover:bg-blue-50"
          >
            {tc('today')}
          </button>
        </div>
      </div>

      <div className="px-4 lg:px-6 py-3 bg-slate-50/80 border-b border-slate-200/70 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-slate-500">{tc('show')}:</span>
        <MultiSelectFilter
          label={tc('type')}
          options={typeOptions}
          selectedIds={selectedTypeIds}
          onChange={setSelectedTypeIds}
          align="left"
        />
        <MultiSelectFilter
          label={tc('accounts')}
          options={accountOptions}
          selectedIds={selectedAccountIds}
          onChange={setSelectedAccountIds}
          align="left"
        />
        <MultiSelectFilter
          label={tc('labels')}
          options={labelOptions}
          selectedIds={selectedLabelIds}
          onChange={setSelectedLabelIds}
        />
      </div>

      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full min-w-[1200px] table-fixed text-left border-separate border-spacing-0">
          <colgroup>
            <col className="w-8" />
            <col className="w-12" />
            <col />
            <col className="w-20" />
            <col className="w-32" />
            <col className="w-32" />
            <col className="w-36" />
            <col className="w-40" />
            <col className="w-40" />
            <col className="w-24" />
          </colgroup>
          <thead>
            <tr className="bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              <th className="py-3 px-1 w-8 border-b border-slate-200" aria-label={tc('order')} />
              <SortableHeader
                label={t('status')}
                column="status"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
                align="center"
                className="w-12"
              />
              <SortableHeader
                label={tc('item')}
                column="name"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
              />
              <SortableHeader
                label={tc('day')}
                column="day"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
                align="center"
              />
              <SortableHeader
                label={tc('amount')}
                column="amount"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
                align="right"
              />
              <th className="py-3 px-4 text-right border-b border-slate-200 whitespace-nowrap" title={t('balanceNotSortable')}>
                {t('balance')}
              </th>
              <SortableHeader
                label={t('source')}
                column="source"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
              />
              <SortableHeader
                label={tc('label')}
                column="label"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
              />
              <SortableHeader
                label={tc('account')}
                column="account"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
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
                    <span className="text-slate-500">{t('plannedIncome')}</span>{' '}
                    <span className="font-bold font-mono text-emerald-700">
                      +{formatCurrency(totalIncome)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">{t('plannedExpense')}</span>{' '}
                    <span className="font-bold font-mono text-rose-700">
                      -{formatCurrency(totalExpense)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">{t('netBalance')}</span>{' '}
                    <span
                      className={`font-bold font-mono ${
                        netBalance >= 0 ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {formatSignedCurrency(netBalance)}
                    </span>
                  </div>
                </div>
                {footerAccounts.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-medium text-slate-500">
                      {t('accountBalancesMonth')}
                    </span>
                    {footerAccounts.map((account) => (
                      <span
                        key={account.id}
                        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[11px] font-medium text-slate-800"
                      >
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: account.color }}
                        />
                        <span>{account.name}</span>
                        <span className="font-mono font-semibold">
                          {formatCurrency(accountEndBalances[account.id] ?? 0)}
                        </span>
                      </span>
                    ))}
                  </div>
                )}
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
            {isChronologicalSort && isCurrentMonth && lastPastOrTodayIndex === -1 && (
              <TodayDividerBand day={currentDay} monthName={getMonthName(month)} />
            )}
            {displayItems.map((item, index) => {
              const isCorrection = item.sourceType === 'opening_correction';
              const isTodayItem = isCurrentMonth && item.day === currentDay;
              const balance = runningBalances[item.id];
              const card = isCorrection ? (
                <div
                  key={item.id}
                  className={`px-4 py-3 ${planItemRowClassName(item, isTodayItem)} ${planItemAccentClass(item, isTodayItem)}`}
                >
                  <PlanMobileCardBody
                    item={item}
                    isTodayItem={isTodayItem}
                    isCurrentMonth={isCurrentMonth}
                    currentDay={currentDay}
                    balance={balance}
                    isChronologicalSort={isChronologicalSort}
                    monthName={getMonthName(month)}
                  />
                </div>
              ) : (
                <MobileRowCard
                  key={item.id}
                  id={item.id}
                  onTap={() => onToggleSettled(item.id, !item.isPaid)}
                  onEdit={() => startInlineEdit(item)}
                  onDelete={
                    item.isCustom
                      ? () => onDeleteCustomItem(item.id)
                      : item.isOverridden && item.originalItemId
                        ? () => onClearOverride(item.originalItemId!)
                        : undefined
                  }
                  deleteLabel={item.isCustom ? tc('confirm') : tc('restore')}
                  reorder={{
                    enabled: reorderEnabled && !isCorrection,
                    groupKey: String(item.day),
                    onDropOn: (targetId, place) => handleMobileDrop(item.id, targetId, place),
                  }}
                  accentClass={planItemAccentClass(item, isTodayItem)}
                  surfaceClassName={planItemRowClassName(item, isTodayItem)}
                >
                  <div className="px-4 py-3">
                    <PlanMobileCardBody
                      item={item}
                      isTodayItem={isTodayItem}
                      isCurrentMonth={isCurrentMonth}
                      currentDay={currentDay}
                      balance={balance}
                      isChronologicalSort={isChronologicalSort}
                      monthName={getMonthName(month)}
                    />
                  </div>
                </MobileRowCard>
              );

              return (
                <React.Fragment key={item.id}>
                  {card}
                  {index === lastPastOrTodayIndex && (
                    <TodayDividerBand day={currentDay} monthName={getMonthName(month)} />
                  )}
                </React.Fragment>
              );
            })}
            <div className="px-4 py-3">
              <button
                type="button"
                onClick={() =>
                  startInlineAdd(
                    displayItems.length,
                    [...displayItems].reverse().find((item) => item.sourceType !== 'opening_correction')
                      ?.day ?? 1,
                    undefined,
                    [...displayItems].reverse().find((item) => item.sourceType !== 'opening_correction')
                      ?.id
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
        {planSummary}
      </div>
    </div>
    {inlineDraft ? renderMobileEditor(inlineDraft) : null}
    <OpeningBalancesPanel
      accounts={house.accounts}
      openingBalances={openingBalances}
      onSetOpeningBalance={onSetOpeningBalance}
    />
    </>
  );
};

function OpeningBalancesPanel({
  accounts,
  openingBalances,
  onSetOpeningBalance,
}: {
  accounts: BankAccount[];
  openingBalances: Record<string, AccountOpeningBalance>;
  onSetOpeningBalance: (accountId: string, amount: number | null) => void;
}) {
  const t = useTranslations('plan');
  const { formatCurrency, formatSignedCurrency } = useBudgetFormat();
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  if (accounts.length === 0) return null;

  const commit = (accountId: string) => {
    const opening = openingBalances[accountId];
    if (!opening) return;
    const raw = drafts[accountId];
    if (raw === undefined) return;
    const parsed = Math.round((parseFloat(raw.replace(',', '.')) || 0) * 100) / 100;
    setDrafts((current) => {
      const next = { ...current };
      delete next[accountId];
      return next;
    });
    if (parsed === opening.effective) return;
    onSetOpeningBalance(accountId, parsed);
  };

  return (
    <div className="bg-white rounded-none lg:rounded-2xl border border-slate-200/90 border-x-0 lg:border-x shadow-sm mb-4 lg:mb-6 px-4 lg:px-6 py-4">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
        {t('openingBalances')}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap gap-2">
        {accounts.map((account) => {
          const opening = openingBalances[account.id];
          if (!opening) return null;
          const value = drafts[account.id] ?? String(opening.effective);
          const hasSet = opening.set !== undefined;
          const correction = opening.correction;

          return (
            <div
              key={account.id}
              className="w-full lg:w-52 flex flex-col gap-1 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2.5 lg:px-2.5 lg:py-1.5"
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: account.color }}
                />
                <span className="text-sm lg:text-[11px] font-semibold text-slate-800 truncate" title={account.name}>
                  {account.name}
                </span>
              </div>
              <div className="text-xs lg:text-[10px] text-slate-500 truncate" title={formatCurrency(opening.carried)}>
                {t('carried')}{' '}
                <span className="font-mono font-medium text-slate-700">
                  {formatCurrency(opening.carried)}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span
                  className={`shrink-0 w-[4.75rem] text-xs lg:text-[10px] font-semibold font-mono text-right tabular-nums ${
                    correction > 0
                      ? 'text-emerald-700'
                      : correction < 0
                        ? 'text-rose-700'
                        : 'text-slate-400'
                  }`}
                  title={t('carriedDifference')}
                >
                  {formatSignedCurrency(correction)}
                </span>
                <input
                  type="number"
                  step="0.01"
                  value={value}
                  onChange={(event) =>
                    setDrafts((current) => ({ ...current, [account.id]: event.target.value }))
                  }
                  onBlur={() => commit(account.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      (event.target as HTMLInputElement).blur();
                    }
                  }}
                  className={`${MOBILE_NUMBER_CLASS} lg:h-6 lg:text-xs lg:rounded-md lg:px-2 min-w-0 flex-1 text-right font-mono`}
                  aria-label={t('openingBalanceAria', { account: account.name })}
                />
                <button
                  type="button"
                  disabled={!hasSet}
                  onClick={() => {
                    setDrafts((current) => {
                      const next = { ...current };
                      delete next[account.id];
                      return next;
                    });
                    onSetOpeningBalance(account.id, null);
                  }}
                  className="inline-flex h-11 w-11 lg:h-auto lg:w-auto lg:p-0.5 items-center justify-center text-slate-400 hover:text-slate-800 rounded hover:bg-slate-100 disabled:invisible"
                  title={t('restoreCarried')}
                >
                  <RotateCcw className="w-4 h-4 lg:w-3 lg:h-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function compareItems(
  a: ResolvedBudgetItem,
  b: ResolvedBudgetItem,
  key: SortKey,
  dir: SortDir,
  indexOf: Map<string, number>,
  collator: Intl.Collator
): number {
  let result = 0;
  switch (key) {
    case 'status':
      result = Number(a.isPaid) - Number(b.isPaid);
      break;
    case 'name':
      result = collator.compare(a.name, b.name);
      break;
    case 'day':
      result = a.day - b.day;
      break;
    case 'amount':
      result = a.amount - b.amount;
      break;
    case 'source':
      result = SOURCE_RANK[a.sourceType] - SOURCE_RANK[b.sourceType];
      break;
    case 'label':
      result = collator.compare(a.labelName || '', b.labelName || '');
      break;
    case 'account':
      result = collator.compare(a.accountName, b.accountName);
      break;
  }

  if (result === 0) {
    return (indexOf.get(a.id) ?? 0) - (indexOf.get(b.id) ?? 0);
  }
  return dir === 'asc' ? result : -result;
}

function InlineAddRow({
  draft,
  accounts,
  labels,
  monthName,
  sourceType,
  isPaid,
  onChange,
  onSave,
  onCancel,
}: {
  draft: InlineDraft;
  accounts: BankAccount[];
  labels: ItemLabel[];
  monthName: string;
  sourceType: ResolvedBudgetItem['sourceType'];
  isPaid: boolean;
  onChange: (patch: Partial<Omit<InlineDraft, 'insertIndex' | 'mode'>>) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations('plan');
  const tc = useTranslations('common');
  const { accountSelectLabel } = useBudgetFormat();
  const nameRef = useRef<HTMLInputElement>(null);
  const selectedLabel = labels.find((label) => label.id === draft.labelId);
  const effectiveAccountId = selectedLabel?.accountId || draft.accountId;
  const accountLocked = Boolean(selectedLabel);

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
      <td className={`${PLAN_CELL} border-blue-200 text-center`}>
        {isPaid ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-600 inline" />
        ) : (
          <Circle className="w-4 h-4 text-slate-300 inline" />
        )}
      </td>
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
        <input
          type="number"
          min={1}
          max={31}
          value={draft.day}
          onChange={(e) => onChange({ day: e.target.value })}
          className={`${INLINE_NUMBER_CLASS} text-center font-mono`}
          aria-label={t('dayOfMonth')}
        />
      </td>
      <td className={`${PLAN_CELL} border-blue-200 text-right`}>
        <input
          type="number"
          step="0.01"
          value={draft.amount}
          onChange={(e) => onChange({ amount: e.target.value })}
          placeholder="0,00"
          title={t('amountHint')}
          className={`${INLINE_NUMBER_CLASS} text-right font-mono`}
          aria-label={t('amountAria')}
        />
      </td>
      <td className={`${PLAN_CELL} border-blue-200 text-right text-slate-400`}>—</td>
      <td className={`${PLAN_CELL} border-blue-200`}>
        <SourceBadge sourceType={sourceType} monthName={monthName} />
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

function SourceBadge({
  sourceType,
  monthName,
}: {
  sourceType: ResolvedBudgetItem['sourceType'];
  monthName: string;
}) {
  const t = useTranslations('plan');
  if (sourceType === 'opening_correction') {
    return (
      <span className="inline-flex max-w-full min-w-0 items-center h-6 px-2 rounded font-medium text-violet-700 bg-violet-50">
        <span className="truncate">{t('openingBalance')}</span>
      </span>
    );
  }
  if (sourceType === 'synced_income') {
    return (
      <span className="inline-flex max-w-full min-w-0 items-center h-6 px-2 rounded font-medium text-emerald-700 bg-emerald-50">
        <span className="truncate">{t('regularIncome')}</span>
      </span>
    );
  }
  if (sourceType === 'synced_monthly_expense') {
    return (
      <span className="inline-flex max-w-full min-w-0 items-center h-6 px-2 rounded font-medium text-slate-600 bg-slate-100">
        <span className="truncate">{t('monthlyExpense')}</span>
      </span>
    );
  }
  if (sourceType === 'synced_annual_expense') {
    return (
      <span
        className="inline-flex max-w-full min-w-0 items-center h-6 px-2 rounded font-medium text-amber-800 bg-amber-50 border border-amber-200/40"
        title={t('annualExpenseMonth', { month: monthName })}
      >
        <span className="truncate">{t('annualExpenseMonth', { month: monthName })}</span>
      </span>
    );
  }
  return (
    <span
      className="inline-flex max-w-full min-w-0 items-center h-6 px-2 rounded font-medium text-blue-700 bg-blue-50"
      title={t('oneOffMonth', { month: monthName })}
    >
      <span className="truncate">{t('oneOffMonth', { month: monthName })}</span>
    </span>
  );
}

function itemAmountClass(item: ResolvedBudgetItem): string {
  if (item.type === 'income') return 'whitespace-nowrap text-emerald-700 font-bold';
  if (item.amount < 0) return 'whitespace-nowrap text-indigo-600';
  return 'whitespace-nowrap text-rose-700';
}

function planItemRowClassName(item: ResolvedBudgetItem, isTodayItem: boolean): string {
  const paidMuted = item.isPaid ? 'text-slate-500' : '';
  if (item.sourceType === 'opening_correction') {
    return 'transition-colors group bg-violet-50/70';
  }
  if (isTodayItem) {
    return `transition-colors group ${item.isOverridden ? 'bg-amber-50/80' : 'bg-blue-50/80'} ${paidMuted}`;
  }
  if (item.isOverridden) {
    return `transition-colors group ${
      item.isPaid ? 'bg-amber-50/70 text-slate-500' : 'bg-amber-50 hover:bg-amber-50/80'
    }`;
  }
  if (item.isCustom) {
    return `transition-colors group ${
      item.isPaid ? 'bg-sky-50/70 text-slate-500' : 'bg-sky-50/80 hover:bg-sky-50'
    }`;
  }
  return `transition-colors group ${
    item.isPaid ? 'bg-slate-50/40 text-slate-500' : 'hover:bg-slate-50/60'
  }`;
}

function planItemAccentClass(item: ResolvedBudgetItem, isTodayItem: boolean): string {
  if (item.sourceType === 'opening_correction') return 'border-l-4 border-l-violet-400';
  if (isTodayItem) return 'border-l-4 border-l-blue-600';
  if (item.isOverridden) return 'border-l-4 border-l-amber-400';
  if (item.isCustom) return 'border-l-4 border-l-sky-300';
  return 'border-l-4 border-l-transparent';
}

function TodayDividerRow({ day, monthName }: { day: number; monthName: string }) {
  return (
    <tr>
      <td colSpan={COLUMN_COUNT} className="p-0">
        <TodayDividerBand day={day} monthName={monthName} />
      </td>
    </tr>
  );
}

function TodayDividerBand({ day, monthName }: { day: number; monthName: string }) {
  const t = useTranslations('plan');
  return (
    <div className="flex items-center gap-2 bg-blue-600 text-white px-4 py-1 text-[11px] font-bold uppercase tracking-wider">
      <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
      <span>
        {t('todayDivider', { date: `${day} ${monthName}` })}
      </span>
    </div>
  );
}

function PlanMobileCardBody({
  item,
  isTodayItem,
  isCurrentMonth,
  currentDay,
  balance,
  isChronologicalSort,
  monthName,
}: {
  item: ResolvedBudgetItem;
  isTodayItem: boolean;
  isCurrentMonth: boolean;
  currentDay: number;
  balance: number | undefined;
  isChronologicalSort: boolean;
  monthName: string;
}) {
  const t = useTranslations('plan');
  const { formatCurrency } = useBudgetFormat();
  return (
    <div className="flex flex-col gap-1.5 min-w-0">
      <div className="flex items-start gap-2 min-w-0">
        {item.sourceType === 'opening_correction' ? (
          <span className="mt-0.5 text-slate-300">—</span>
        ) : item.isPaid ? (
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600 mt-0.5" />
        ) : (
          <Circle className="w-5 h-5 shrink-0 text-slate-400 mt-0.5" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className={`font-semibold truncate min-w-0 flex-1 ${
                item.isPaid ? 'line-through text-slate-500' : 'text-slate-900'
              }`}
              title={item.name}
            >
              {item.name}
            </span>
            {item.isOverridden && (
              <span className="shrink-0 text-[10px] leading-none bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-semibold border border-amber-300">
                {t('overridden')}
              </span>
            )}
          </div>
        </div>
        <span className={`shrink-0 font-mono font-semibold ${itemAmountClass(item)}`}>
          {formatCurrency(item.amount)}
        </span>
      </div>
      {item.notes ? (
        <span className="text-[11px] text-slate-400 truncate pl-7" title={item.notes}>
          {item.notes}
        </span>
      ) : null}
      <div className="flex flex-wrap items-center gap-1.5 pl-7">
        <span
          className={`inline-flex items-center justify-center h-6 min-w-6 px-2 rounded font-semibold font-mono text-[11px] ${
            isTodayItem
              ? 'bg-blue-600 text-white'
              : isCurrentMonth && item.day < currentDay
                ? 'bg-slate-100 text-slate-600'
                : 'bg-slate-200/70 text-slate-800'
          }`}
        >
          {item.day}.
        </span>
        <span
          className={`inline-flex items-center h-6 px-2 rounded font-mono text-[11px] ${
            balance !== undefined && balance < 0
              ? 'text-rose-700 font-semibold bg-rose-50'
              : isChronologicalSort
                ? 'text-slate-800 font-semibold bg-slate-100'
                : 'text-slate-400 italic bg-slate-50'
          }`}
        >
          {balance === undefined ? '—' : formatCurrency(balance)}
        </span>
        <SourceBadge sourceType={item.sourceType} monthName={monthName} />
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
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.accountColor }} />
          <span className="truncate">{item.accountName}</span>
        </span>
      </div>
    </div>
  );
}

function PlanMobileEditor({
  draft,
  accounts,
  labels,
  monthName,
  sourceType,
  isPaid,
  onChange,
  onSave,
  onCancel,
}: {
  draft: InlineDraft;
  accounts: BankAccount[];
  labels: ItemLabel[];
  monthName: string;
  sourceType: ResolvedBudgetItem['sourceType'];
  isPaid: boolean;
  onChange: (patch: Partial<Omit<InlineDraft, 'insertIndex' | 'mode'>>) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations('plan');
  const tc = useTranslations('common');
  const { accountSelectLabel } = useBudgetFormat();
  const selectedLabel = labels.find((label) => label.id === draft.labelId);
  const effectiveAccountId = selectedLabel?.accountId || draft.accountId;
  const accountLocked = Boolean(selectedLabel);

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
          <input
            type="number"
            min={1}
            max={31}
            value={draft.day}
            onChange={(e) => onChange({ day: e.target.value })}
            className={`${MOBILE_NUMBER_CLASS} text-center font-mono`}
            aria-label={t('dayOfMonth')}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">{tc('amount')}</span>
          <input
            type="number"
            step="0.01"
            value={draft.amount}
            onChange={(e) => onChange({ amount: e.target.value })}
            placeholder="0,00"
            title={t('amountHint')}
            aria-label={t('amountAria')}
            className={`${MOBILE_NUMBER_CLASS} text-right font-mono`}
          />
        </label>
      </div>
      <div className="flex items-center gap-2 text-xs text-slate-500">
        {isPaid ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
        ) : (
          <Circle className="w-4 h-4 text-slate-300" />
        )}
        <SourceBadge sourceType={sourceType} monthName={monthName} />
      </div>
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
