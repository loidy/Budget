'use client';

import React, { useEffect, useOptimistic, useState, useTransition } from 'react';
import {
  Calendar,
  LayoutList,
  LineChart,
  Loader2,
  Menu,
  Settings2,
  Table,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import {
  BankAccount,
  BudgetItemOverride,
  CatalogItem,
  CatalogKind,
  CatalogSnapshot,
  CatalogTableView,
  CatalogViewState,
  House,
  ItemLabel,
  MonthBudgetPlan,
  SessionUser,
} from '../types';
import {
  applyCatalogItemToHouse,
  applyCatalogOrderToHouse,
  applyDeleteSnapshotToHouse,
  applyLockCatalogToHouse,
  applySnapshotValidUntilToHouse,
  catalogScopeById,
  computeCashFlowRange,
  dashboardAccounts,
  effectiveAsOf,
  summarizeCashFlow,
  getCatalogRows,
  getMonthOpeningBalances,
  getResolvedMonthlyBudgetPlan,
  isOpeningCorrectionId,
  mainCatalogValidFrom,
  mapAllCatalogItems,
  orderedIdsAfterInsert,
  removeCatalogItemFromHouse,
  toItemPositions,
} from '../utils/budgetLogic';
import { useTranslations } from 'next-intl';
import { useBudgetFormat } from '../i18n/useBudgetFormat';
import { formatMonthSlash, formatMonthKey, parseMonthKey } from '../utils/formatters';
import { NEW_HOUSE_ACCOUNT, NEW_HOUSE_LABEL } from '../lib/defaults';
import { newId } from '../lib/ids';
import {
  buildAppSearchParams,
  defaultCatalogViewState,
  parseAppSearchParams,
  sanitizeCatalogViewState,
  writeShallowUrl,
  type AppTabId,
} from '../lib/catalogView';

import * as accountActions from '../actions/accounts';
import * as catalogActions from '../actions/catalog';
import * as catalogSnapshotActions from '../actions/catalogSnapshots';
import * as catalogViewActions from '../actions/catalogViews';
import * as houseActions from '../actions/houses';
import * as planActions from '../actions/plans';

import { AccountManager } from './AccountManager';
import { BudgetPlanView } from './BudgetPlanView';
import { CatalogHistory, LockCatalogButton } from './CatalogHistory';
import { ProjectionChart } from './ProjectionChart';
import { EmptyState } from './EmptyState';
import { HouseSelector } from './HouseSelector';
import { IncomeExpenseTable } from './IncomeExpenseTable';
import { MobileDrawer } from './MobileDrawer';
import { SaveCatalogViewButton, SavedCatalogTables } from './SavedCatalogTables';
import { SummaryCards } from './SummaryCards';
import { UserMenu } from './UserMenu';

const TABS = [
  { id: 'cashflow', Icon: LineChart },
  { id: 'budget_plan', Icon: Calendar },
  { id: 'catalog', Icon: Table },
  { id: 'tables', Icon: LayoutList },
  { id: 'manage', Icon: Settings2 },
] satisfies { id: AppTabId; Icon: LucideIcon }[];

const TAB_LABEL_KEYS = {
  cashflow: 'nav.cashflow',
  budget_plan: 'nav.budgetPlan',
  catalog: 'nav.catalog',
  tables: 'nav.tables',
  manage: 'nav.manage',
} as const satisfies Record<AppTabId, 'nav.cashflow' | 'nav.budgetPlan' | 'nav.catalog' | 'nav.tables' | 'nav.manage'>;

type HousesMutator = (houses: House[]) => House[];

const EMPTY_PLAN = (monthKey: string): MonthBudgetPlan => ({
  monthKey,
  overrides: {},
  customItems: [],
  settledItemIds: {},
  itemPositions: {},
  openingBalances: {},
});

interface BudgetAppProps {
  user: SessionUser;
  houses: House[];
  initialMonthKey: string;
  initialDay: number;
  initialHouseId: string;
  initialTab: AppTabId;
  initialCatalogView: CatalogViewState;
}

export function BudgetApp({
  user,
  houses: persistedHouses,
  initialMonthKey,
  initialDay,
  initialHouseId,
  initialTab,
  initialCatalogView,
}: BudgetAppProps) {
  const t = useTranslations();
  const { getMonthName, formatDayMonthYear } = useBudgetFormat();
  const [isSaving, startTransition] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);

  // Mutations render instantly against this copy and are replaced by the
  // server's own data once the action's revalidation lands.
  const [houses, applyOptimistic] = useOptimistic(
    persistedHouses,
    (current: House[], mutate: HousesMutator) => mutate(current)
  );

  const startingHouse =
    persistedHouses.find((house) => house.id === initialHouseId) ?? persistedHouses[0];

  const [activeHouseId, setActiveHouseId] = useState<string>(startingHouse.id);
  const [activeTab, setActiveTab] = useState<AppTabId>(initialTab);
  const [catalogView, setCatalogView] = useState<CatalogViewState>(() =>
    sanitizeCatalogViewState(initialCatalogView, startingHouse)
  );
  const [selectedMonthKey, setSelectedMonthKey] = useState(initialMonthKey);
  const [menuOpen, setMenuOpen] = useState(false);
  const currentDay = initialDay;

  const syncUrl = (
    next: { houseId: string; tab: AppTabId; catalogView: CatalogViewState },
    mode: 'push' | 'replace',
    housesForUrl: House[] = houses
  ) => {
    writeShallowUrl(buildAppSearchParams({ ...next, houses: housesForUrl }), mode);
  };

  useEffect(() => {
    const onPopState = () => {
      const parsed = parseAppSearchParams(new URLSearchParams(window.location.search), houses);
      if (!parsed.houseId) return;
      setActiveHouseId(parsed.houseId);
      setActiveTab(parsed.tab);
      setCatalogView(parsed.catalogView);
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [houses]);

  const selectTab = (tab: AppTabId) => {
    setActiveTab(tab);
    setMenuOpen(false);
    syncUrl({ houseId: activeHouseId, tab, catalogView }, 'push');
  };

  const selectHouse = (houseId: string) => {
    const nextHouse = houses.find((house) => house.id === houseId);
    const nextView = nextHouse ? defaultCatalogViewState(nextHouse) : catalogView;
    setActiveHouseId(houseId);
    setCatalogView(nextView);
    setMenuOpen(false);
    syncUrl({ houseId, tab: activeTab, catalogView: nextView }, 'push');
  };

  const changeCatalogView = (next: CatalogViewState) => {
    const house = houses.find((item) => item.id === activeHouseId) ?? houses[0];
    const sanitized = house ? sanitizeCatalogViewState(next, house) : next;
    setCatalogView(sanitized);
    syncUrl({ houseId: activeHouseId, tab: activeTab, catalogView: sanitized }, 'replace');
  };

  const activeHouse = houses.find((h) => h.id === activeHouseId) ?? houses[0];
  if (!activeHouse) {
    return <EmptyState user={user} />;
  }

  const { year, month } = parseMonthKey(selectedMonthKey);
  const monthName = getMonthName(month);
  const { year: todayYear, month: todayMonth } = parseMonthKey(initialMonthKey);

  /**
   * Applies a local update immediately, then persists it. React keeps the
   * optimistic value on screen until the transition settles; if the action
   * throws, the value rolls back and the error is surfaced.
   */
  const mutate = (localUpdate: HousesMutator, persist: () => Promise<void>) => {
    setSaveError(null);

    startTransition(async () => {
      applyOptimistic(localUpdate);

      try {
        await persist();
      } catch (error) {
        console.error('Failed to persist budget change', error);
        setSaveError(
          error instanceof Error
            ? t('errors.saveFailedWithReason', { message: error.message })
            : t('errors.saveFailed')
        );
      }
    });
  };

  const inHouse =
    (houseId: string, updater: (house: House) => House): HousesMutator =>
    (current) =>
      current.map((house) => (house.id === houseId ? updater(house) : house));

  const inActiveHouse = (updater: (house: House) => House): HousesMutator =>
    inHouse(activeHouse.id, updater);

  const inActivePlan = (updater: (plan: MonthBudgetPlan) => MonthBudgetPlan): HousesMutator =>
    inActiveHouse((house) => ({
      ...house,
      monthlyPlans: {
        ...house.monthlyPlans,
        [selectedMonthKey]: updater(
          house.monthlyPlans[selectedMonthKey] ?? EMPTY_PLAN(selectedMonthKey)
        ),
      },
    }));

  // Houses
  const handleAddHouse = (name: string, description: string, icon: string) => {
    const input: houseActions.NewHouseInput = {
      id: newId('house'),
      name,
      description,
      icon,
      defaultAccountId: newId('acc'),
      defaultLabelId: newId('lbl'),
      defaultAccountName: t('houses.defaultAccount'),
      defaultLabelName: t('houses.defaultLabel'),
    };

    const newHouse: House = {
      id: input.id,
      name,
      description,
      icon,
      role: 'owner',
      members: [],
      accounts: [{ ...NEW_HOUSE_ACCOUNT, id: input.defaultAccountId, name: t('houses.defaultAccount') }],
      labels: [
        {
          ...NEW_HOUSE_LABEL,
          id: input.defaultLabelId,
          accountId: input.defaultAccountId,
          name: t('houses.defaultLabel'),
        },
      ],
      incomes: [],
      expenses: [],
      monthlyPlans: {},
      catalogTableViews: [],
      catalogSnapshots: [],
    };

    const nextView = defaultCatalogViewState(newHouse);
    setActiveHouseId(input.id);
    setCatalogView(nextView);
    syncUrl({ houseId: input.id, tab: activeTab, catalogView: nextView }, 'push', [
      ...houses,
      newHouse,
    ]);
    mutate(
      (current) => [...current, newHouse],
      () => houseActions.createHouse(input)
    );
  };

  const handleUpdateHouse = (
    houseId: string,
    name: string,
    description: string,
    icon: string
  ) => {
    mutate(
      inHouse(houseId, (house) => ({ ...house, name, description, icon })),
      () => houseActions.updateHouse(houseId, { name, description, icon })
    );
  };

  const handleDeleteHouse = (houseId: string) => {
    const remaining = houses.filter((h) => h.id !== houseId);
    if (remaining[0]) {
      const nextView = defaultCatalogViewState(remaining[0]);
      setActiveHouseId(remaining[0].id);
      setCatalogView(nextView);
      syncUrl(
        { houseId: remaining[0].id, tab: activeTab, catalogView: nextView },
        'push',
        remaining
      );
    }
    mutate(
      () => remaining,
      () => houseActions.deleteHouse(houseId)
    );
  };

  const handleShareHouse = (houseId: string, email: string) => {
    mutate(
      (current) => current,
      () => houseActions.shareHouse(houseId, email)
    );
  };

  const handleUnshareHouse = (houseId: string, userId: string) => {
    mutate(
      inHouse(houseId, (house) => ({
        ...house,
        members: house.members.filter((member) => member.userId !== userId),
      })),
      () => houseActions.unshareHouse(houseId, userId)
    );
  };

  // Accounts
  const handleAddAccount = (accountData: Omit<BankAccount, 'id'>) => {
    const account: BankAccount = { ...accountData, id: newId('acc') };

    mutate(
      inActiveHouse((house) => ({ ...house, accounts: [...house.accounts, account] })),
      () => accountActions.createAccount(activeHouse.id, account)
    );
  };

  const handleUpdateAccount = (account: BankAccount) => {
    mutate(
      inActiveHouse((house) => ({
        ...house,
        accounts: house.accounts.map((a) => (a.id === account.id ? account : a)),
      })),
      () => accountActions.updateAccount(activeHouse.id, account)
    );
  };

  const handleDeleteAccount = (accountId: string) => {
    mutate(
      inActiveHouse((house) => {
        const fallbackId = house.accounts.find((a) => a.id !== accountId)?.id ?? null;
        const removedLabelIds = new Set(
          house.labels.filter((l) => l.accountId === accountId).map((l) => l.id)
        );

        return mapAllCatalogItems(
          {
            ...house,
            accounts: house.accounts.filter((a) => a.id !== accountId),
            labels: house.labels.filter((l) => l.accountId !== accountId),
          },
          (i) => ({
            ...i,
            accountId: i.accountId === accountId ? fallbackId : i.accountId,
            labelId: i.labelId && removedLabelIds.has(i.labelId) ? null : i.labelId,
          }),
          (e) => ({
            ...e,
            accountId: e.accountId === accountId ? fallbackId : e.accountId,
            labelId: e.labelId && removedLabelIds.has(e.labelId) ? null : e.labelId,
          })
        );
      }),
      () => accountActions.deleteAccount(activeHouse.id, accountId)
    );
  };

  // Labels
  const handleAddLabel = (name: string, color: string, accountId: string) => {
    const label: ItemLabel = { id: newId('lbl'), name, color, accountId };

    mutate(
      inActiveHouse((house) => ({ ...house, labels: [...house.labels, label] })),
      () => accountActions.createLabel(activeHouse.id, label)
    );
  };

  const handleUpdateLabel = (label: ItemLabel) => {
    mutate(
      inActiveHouse((house) => ({
        ...house,
        labels: house.labels.map((l) => (l.id === label.id ? label : l)),
      })),
      () => accountActions.updateLabel(activeHouse.id, label)
    );
  };

  const handleDeleteLabel = (labelId: string) => {
    mutate(
      inActiveHouse((house) =>
        mapAllCatalogItems(
          { ...house, labels: house.labels.filter((l) => l.id !== labelId) },
          (i) => (i.labelId === labelId ? { ...i, labelId: null } : i),
          (e) => (e.labelId === labelId ? { ...e, labelId: null } : e)
        )
      ),
      () => accountActions.deleteLabel(activeHouse.id, labelId)
    );
  };

  // Master catalog
  const handleSaveCatalogItem = (
    item: CatalogItem,
    previousKind?: CatalogKind,
    placement?: { beforeId?: string; afterId?: string },
    snapshotId?: string | null
  ) => {
    const id =
      item.id || (item.kind === 'monthly_income' ? newId('inc') : newId('exp'));
    const saved: CatalogItem = { ...item, id };
    const isNew = !previousKind;
    const currentIds = getCatalogRows(activeHouse, catalogScopeById(activeHouse, snapshotId)).map(
      (row) => row.id
    );
    const shouldPlace = Boolean(placement?.beforeId || placement?.afterId);
    const orderedIds =
      isNew && shouldPlace ? orderedIdsAfterInsert(currentIds, saved.id, placement) : undefined;

    mutate(
      inActiveHouse((house) => {
        const withItem = applyCatalogItemToHouse(house, saved, previousKind, snapshotId);
        return orderedIds ? applyCatalogOrderToHouse(withItem, orderedIds, snapshotId) : withItem;
      }),
      async () => {
        await catalogActions.saveCatalogItem(activeHouse.id, saved, previousKind, snapshotId);
        if (orderedIds) {
          await catalogActions.reorderCatalogItems(activeHouse.id, orderedIds, snapshotId);
        }
      }
    );
  };

  const handleDeleteCatalogItem = (itemId: string, snapshotId?: string | null) => {
    mutate(
      inActiveHouse((house) => removeCatalogItemFromHouse(house, itemId, snapshotId)),
      () => catalogActions.deleteCatalogItem(activeHouse.id, itemId, snapshotId)
    );
  };

  const handleReorderCatalogItems = (orderedItemIds: string[], snapshotId?: string | null) => {
    mutate(
      inActiveHouse((house) => applyCatalogOrderToHouse(house, orderedItemIds, snapshotId)),
      () => catalogActions.reorderCatalogItems(activeHouse.id, orderedItemIds, snapshotId)
    );
  };

  const handleLockCatalog = (validUntil: string) => {
    const copies = [
      ...activeHouse.incomes.map((income) => ({ sourceId: income.id, id: newId('inc') })),
      ...activeHouse.expenses.map((expense) => ({ sourceId: expense.id, id: newId('exp') })),
    ];
    const snapshot: CatalogSnapshot = {
      id: newId('snap'),
      validUntil,
      createdAt: new Date().toISOString(),
      incomes: [],
      expenses: [],
    };

    mutate(
      inActiveHouse((house) => applyLockCatalogToHouse(house, snapshot, copies)),
      () =>
        catalogSnapshotActions.lockCatalog(activeHouse.id, {
          id: snapshot.id,
          validUntil,
          copies,
        })
    );
  };

  const handleChangeSnapshotValidUntil = (snapshotId: string, validUntil: string) => {
    mutate(
      inActiveHouse((house) => applySnapshotValidUntilToHouse(house, snapshotId, validUntil)),
      () =>
        catalogSnapshotActions.updateCatalogSnapshotValidUntil(
          activeHouse.id,
          snapshotId,
          validUntil
        )
    );
  };

  const handleDeleteSnapshot = (snapshotId: string) => {
    mutate(
      inActiveHouse((house) => applyDeleteSnapshotToHouse(house, snapshotId)),
      () => catalogSnapshotActions.deleteCatalogSnapshot(activeHouse.id, snapshotId)
    );
  };

  const handleSaveCatalogView = (name: string) => {
    const snapshot = sanitizeCatalogViewState(catalogView, activeHouse);
    const saved: CatalogTableView = {
      id: newId('view'),
      name,
      position: activeHouse.catalogTableViews.length,
      view: snapshot,
    };

    mutate(
      inActiveHouse((house) => ({
        ...house,
        catalogTableViews: [...house.catalogTableViews, saved],
      })),
      () =>
        catalogViewActions.createCatalogTableView(activeHouse.id, {
          id: saved.id,
          name: saved.name,
          kindIds: snapshot.kindIds,
          accountIds: snapshot.accountIds,
          labelIds: snapshot.labelIds,
          sortKey: snapshot.sortKey,
          sortDir: snapshot.sortDir,
        })
    );
  };

  const handleRenameCatalogView = (viewId: string, name: string) => {
    mutate(
      inActiveHouse((house) => ({
        ...house,
        catalogTableViews: house.catalogTableViews.map((view) =>
          view.id === viewId ? { ...view, name } : view
        ),
      })),
      () => catalogViewActions.updateCatalogTableView(activeHouse.id, viewId, { name })
    );
  };

  const handleDeleteCatalogView = (viewId: string) => {
    mutate(
      inActiveHouse((house) => ({
        ...house,
        catalogTableViews: house.catalogTableViews.filter((view) => view.id !== viewId),
      })),
      () => catalogViewActions.deleteCatalogTableView(activeHouse.id, viewId)
    );
  };

  // Month plan deviations
  const handleSetOverride = (
    originalItemId: string,
    overrideData: Partial<BudgetItemOverride>
  ) => {
    const existing = activeHouse.monthlyPlans[selectedMonthKey]?.overrides[originalItemId];

    const override: BudgetItemOverride = {
      id: existing?.id ?? newId('ovr'),
      originalItemId,
      isCustom: false,
      type: overrideData.type ?? existing?.type ?? 'expense',
      name: overrideData.name || existing?.name || '',
      amount: overrideData.amount ?? existing?.amount ?? 0,
      day: overrideData.day ?? existing?.day ?? 1,
      accountId: overrideData.accountId || existing?.accountId || '',
      labelId: overrideData.labelId !== undefined ? overrideData.labelId : existing?.labelId,
      notes: overrideData.notes !== undefined ? overrideData.notes : existing?.notes,
      isPaid: overrideData.isPaid !== undefined ? overrideData.isPaid : existing?.isPaid,
    };

    mutate(
      inActivePlan((plan) => ({
        ...plan,
        overrides: { ...plan.overrides, [originalItemId]: override },
      })),
      () => planActions.setOverride(activeHouse.id, selectedMonthKey, override)
    );
  };

  const handleClearOverride = (originalItemId: string) => {
    mutate(
      inActivePlan((plan) => {
        const overrides = { ...plan.overrides };
        delete overrides[originalItemId];
        return { ...plan, overrides };
      }),
      () => planActions.clearOverride(activeHouse.id, selectedMonthKey, originalItemId)
    );
  };

  const handleAddCustomItem = (
    customItemData: Omit<BudgetItemOverride, 'id' | 'isCustom'>,
    placement?: { beforeId?: string; afterId?: string }
  ) => {
    const item: BudgetItemOverride = {
      ...customItemData,
      id: newId('custom'),
      isCustom: true,
    };

    const currentIds = getResolvedMonthlyBudgetPlan(activeHouse, selectedMonthKey)
      .map((resolved) => resolved.id)
      .filter((id) => !isOpeningCorrectionId(id));
    const hasSavedOrder = Object.keys(
      activeHouse.monthlyPlans[selectedMonthKey]?.itemPositions ?? {}
    ).length > 0;
    const shouldPlace = Boolean(placement?.beforeId || placement?.afterId);
    const shouldPersistOrder = shouldPlace || hasSavedOrder;
    const orderedIds = shouldPersistOrder
      ? orderedIdsAfterInsert(currentIds, item.id, placement)
      : currentIds;
    const nextPositions = shouldPersistOrder ? toItemPositions(orderedIds) : undefined;

    mutate(
      inActivePlan((plan) => ({
        ...plan,
        customItems: [...plan.customItems, item],
        itemPositions: nextPositions ?? plan.itemPositions,
      })),
      async () => {
        await planActions.addCustomItem(activeHouse.id, selectedMonthKey, item);
        if (nextPositions) {
          await planActions.reorderPlanItems(activeHouse.id, selectedMonthKey, orderedIds);
        }
      }
    );
  };

  const handleUpdateCustomItem = (item: BudgetItemOverride) => {
    mutate(
      inActivePlan((plan) => ({
        ...plan,
        customItems: plan.customItems.map((c) => (c.id === item.id ? item : c)),
      })),
      () => planActions.updateCustomItem(activeHouse.id, selectedMonthKey, item)
    );
  };

  const handleDeleteCustomItem = (customItemId: string) => {
    mutate(
      inActivePlan((plan) => ({
        ...plan,
        customItems: plan.customItems.filter((c) => c.id !== customItemId),
      })),
      () => planActions.deleteCustomItem(activeHouse.id, selectedMonthKey, customItemId)
    );
  };

  const handleToggleSettled = (itemId: string, settled: boolean) => {
    mutate(
      inActivePlan((plan) => ({
        ...plan,
        settledItemIds: { ...plan.settledItemIds, [itemId]: settled },
      })),
      () => planActions.toggleSettled(activeHouse.id, selectedMonthKey, itemId, settled)
    );
  };

  const handleReorderItems = (orderedItemIds: string[]) => {
    const persistedIds = orderedItemIds.filter((id) => !isOpeningCorrectionId(id));
    mutate(
      inActivePlan((plan) => ({
        ...plan,
        itemPositions: toItemPositions(persistedIds),
      })),
      () => planActions.reorderPlanItems(activeHouse.id, selectedMonthKey, persistedIds)
    );
  };

  const handleSetOpeningBalance = (accountId: string, amount: number | null) => {
    mutate(
      inActivePlan((plan) => {
        const openingBalances = { ...plan.openingBalances };
        if (amount === null) {
          delete openingBalances[accountId];
        } else {
          openingBalances[accountId] = amount;
        }
        return { ...plan, openingBalances };
      }),
      () => planActions.setOpeningBalance(activeHouse.id, selectedMonthKey, accountId, amount)
    );
  };

  // Derived data for the current month and dashboard account scope
  const resolvedItems = getResolvedMonthlyBudgetPlan(activeHouse, selectedMonthKey);
  const liveCatalogValidFrom = mainCatalogValidFrom(activeHouse);
  const dashAccounts = dashboardAccounts(activeHouse.accounts);
  const dashAccountIds = dashAccounts.map((account) => account.id);
  const yearStart = formatMonthKey(year, 1);
  const yearEnd = formatMonthKey(year, 12);
  const monthlyCashFlow =
    activeTab === 'cashflow'
      ? computeCashFlowRange(activeHouse, selectedMonthKey, selectedMonthKey, dashAccountIds)
      : { points: [], openingByAccount: {} };
  const yearlyCashFlow =
    activeTab === 'cashflow'
      ? computeCashFlowRange(activeHouse, yearStart, yearEnd, dashAccountIds)
      : { points: [], openingByAccount: {} };
  const monthSummary =
    activeTab === 'cashflow'
      ? summarizeCashFlow(
          monthlyCashFlow.points,
          monthlyCashFlow.openingByAccount,
          dashAccountIds,
          effectiveAsOf(selectedMonthKey, selectedMonthKey, initialMonthKey, currentDay)
        )
      : summarizeCashFlow([], {}, [], { monthKey: selectedMonthKey, day: 0 });

  const tabClass = (tab: AppTabId) =>
    `flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all shrink-0 ${
      activeTab === tab
        ? 'bg-blue-600 text-white shadow-2xs'
        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
    }`;

  const houseSelectorProps = {
    user,
    houses,
    activeHouseId: activeHouse.id,
    onSelectHouse: selectHouse,
    onAddHouse: handleAddHouse,
    onUpdateHouse: handleUpdateHouse,
    onDeleteHouse: handleDeleteHouse,
    onShareHouse: handleShareHouse,
    onUnshareHouse: handleUnshareHouse,
  };

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 flex flex-col font-sans overflow-x-hidden selection:bg-blue-100 selection:text-blue-900">
      <div className="hidden lg:block">
        <HouseSelector {...houseSelectorProps} />
      </div>

      <MobileDrawer
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        footer={<UserMenu user={user} layout="menu" />}
      >
        <HouseSelector {...houseSelectorProps} layout="menu" />
        <nav className="border-t border-slate-800 px-3 py-3">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => selectTab(tab.id)}
              className={`mb-1 flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-semibold ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <tab.Icon className="h-4 w-4 shrink-0" />
              <span>{t(TAB_LABEL_KEYS[tab.id])}</span>
            </button>
          ))}
        </nav>
      </MobileDrawer>

      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-3 lg:py-3.5 gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                onClick={() => setMenuOpen(true)}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 lg:hidden"
                aria-label={t('common.openMenu')}
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="hidden w-10 h-10 rounded-xl bg-blue-600 text-white lg:flex items-center justify-center shadow-xs shrink-0">
                <LineChart className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <h1 className="text-base lg:text-lg font-bold text-slate-900 leading-tight truncate">
                    {activeHouse.name || t('houses.fallbackTitle')}
                  </h1>
                  {isSaving && (
                    <span
                      className="flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200 shrink-0"
                      title={t('common.savingTitle')}
                    >
                      <Loader2 className="w-3 h-3 animate-spin" />
                      {t('common.saving')}
                    </span>
                  )}
                </div>
                <p className="hidden lg:block text-xs text-slate-500 truncate max-w-md">
                  {activeHouse.description || t('houses.fallbackDescription')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 lg:gap-2 shrink-0">
              <Calendar className="w-4 h-4 lg:w-5 lg:h-5 text-blue-600" />
              <span className="text-sm lg:text-base font-semibold text-slate-900 tabular-nums">
                {formatDayMonthYear(currentDay, todayMonth, todayYear)}
              </span>
            </div>
          </div>

          <nav className="hidden lg:flex items-center gap-1 overflow-x-auto pt-1 pb-2 scrollbar-none">
            {TABS.map((tab) => (
              <button key={tab.id} onClick={() => selectTab(tab.id)} className={tabClass(tab.id)}>
                <tab.Icon className="w-4 h-4" />
                <span>{t(TAB_LABEL_KEYS[tab.id])}</span>
              </button>
            ))}
          </nav>
        </div>
      </header>

      {saveError && (
        <div className="bg-rose-50 border-b border-rose-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between gap-3">
            <p className="text-xs font-semibold text-rose-800">{saveError}</p>
            <button
              onClick={() => setSaveError(null)}
              className="p-1 text-rose-500 hover:text-rose-800 rounded hover:bg-rose-100"
              title={t('common.close')}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-0 sm:px-0 lg:px-8 py-3 lg:py-6 flex-1 w-full">
        {activeTab === 'cashflow' && (
          <>
            <SummaryCards summary={monthSummary} accounts={dashAccounts} monthName={monthName} />

            <ProjectionChart
              chartId="month"
              title={t('cashflow.projection')}
              infoText={t('cashflow.monthInfo')}
              points={monthlyCashFlow.points}
              openingByAccount={monthlyCashFlow.openingByAccount}
              accounts={dashAccounts}
              rangeStartMonthKey={selectedMonthKey}
              rangeEndMonthKey={selectedMonthKey}
              todayMonthKey={initialMonthKey}
              todayDay={currentDay}
              xAxis="days"
              openingLabel={t('cashflow.openingMonth', { month: monthName })}
              currentLabel={t('cashflow.balanceToday')}
              netLabel={t('cashflow.netMonth')}
              endLabel={t('cashflow.endMonth')}
              monthKey={selectedMonthKey}
              onChangeMonth={setSelectedMonthKey}
            />

            <ProjectionChart
              chartId="year"
              title={t('cashflow.yearProjection')}
              infoText={t('cashflow.yearInfo')}
              points={yearlyCashFlow.points}
              openingByAccount={yearlyCashFlow.openingByAccount}
              accounts={dashAccounts}
              rangeStartMonthKey={yearStart}
              rangeEndMonthKey={yearEnd}
              todayMonthKey={initialMonthKey}
              todayDay={currentDay}
              xAxis="months"
              openingLabel={t('cashflow.openingYear', { month: getMonthName(1) })}
              currentLabel={t('cashflow.balanceToday')}
              netLabel={t('cashflow.netYear')}
              endLabel={t('cashflow.endYear')}
            />
          </>
        )}

        {activeTab === 'budget_plan' && (
          <BudgetPlanView
            house={activeHouse}
            monthKey={selectedMonthKey}
            todayMonthKey={initialMonthKey}
            onChangeMonth={setSelectedMonthKey}
            currentDay={currentDay}
            resolvedItems={resolvedItems}
            onSetOverride={handleSetOverride}
            onClearOverride={handleClearOverride}
            onAddCustomItem={handleAddCustomItem}
            onUpdateCustomItem={handleUpdateCustomItem}
            onDeleteCustomItem={handleDeleteCustomItem}
            onToggleSettled={handleToggleSettled}
            onReorderItems={handleReorderItems}
            openingBalances={getMonthOpeningBalances(activeHouse, selectedMonthKey)}
            onSetOpeningBalance={handleSetOpeningBalance}
          />
        )}

        {activeTab === 'catalog' && (
          <>
            <IncomeExpenseTable
              house={activeHouse}
              viewState={sanitizeCatalogViewState(catalogView, activeHouse)}
              onViewStateChange={changeCatalogView}
              showInfoTooltip
              title={
                <div className="flex items-center gap-2 min-w-0">
                  <h3 className="text-lg font-semibold text-slate-900 truncate">{t('catalog.title')}</h3>
                  {liveCatalogValidFrom ? (
                    <span className="shrink-0 text-[11px] font-semibold text-slate-600 bg-slate-100 border border-slate-200 rounded-full px-2 py-0.5">
                      {t('catalog.validFrom', { month: formatMonthSlash(liveCatalogValidFrom) })}
                    </span>
                  ) : null}
                </div>
              }
              headerActions={
                <div className="flex items-center gap-2">
                  <LockCatalogButton
                    house={activeHouse}
                    todayMonthKey={initialMonthKey}
                    onLock={handleLockCatalog}
                  />
                  <SaveCatalogViewButton onSave={handleSaveCatalogView} />
                </div>
              }
              onSaveItem={handleSaveCatalogItem}
              onDeleteItem={handleDeleteCatalogItem}
              onReorderItems={handleReorderCatalogItems}
            />
            <CatalogHistory
              house={activeHouse}
              todayMonthKey={initialMonthKey}
              onSaveItem={handleSaveCatalogItem}
              onDeleteItem={handleDeleteCatalogItem}
              onReorderItems={handleReorderCatalogItems}
              onChangeValidUntil={handleChangeSnapshotValidUntil}
              onDeleteSnapshot={handleDeleteSnapshot}
            />
          </>
        )}

        {activeTab === 'tables' && (
          <SavedCatalogTables
            house={activeHouse}
            onSaveItem={handleSaveCatalogItem}
            onDeleteItem={handleDeleteCatalogItem}
            onReorderItems={handleReorderCatalogItems}
            onRenameView={handleRenameCatalogView}
            onDeleteView={handleDeleteCatalogView}
          />
        )}

        {activeTab === 'manage' && (
          <div className="px-4 lg:px-0">
            <AccountManager
              accounts={activeHouse.accounts}
              labels={activeHouse.labels}
              onAddAccount={handleAddAccount}
              onUpdateAccount={handleUpdateAccount}
              onDeleteAccount={handleDeleteAccount}
              onAddLabel={handleAddLabel}
              onUpdateLabel={handleUpdateLabel}
              onDeleteLabel={handleDeleteLabel}
            />
          </div>
        )}
      </main>
    </div>
  );
}
