import {
  House,
  BankAccount,
  ItemLabel,
  IncomeItem,
  ExpenseItem,
  ResolvedBudgetItem,
  CashFlowPoint,
  CatalogKind,
  CatalogItem,
  CatalogRow,
  CatalogSnapshot,
  MonthBudgetPlan,
  ACCOUNT_VISIBILITY,
} from '../types';
import { parseMonthKey, getDaysInMonth, shiftMonthKey } from './formatters';

/** Accounts that still appear in plan / catalog views (visibility 0 and 1). */
export function visibleAccounts(accounts: BankAccount[]): BankAccount[] {
  return accounts.filter((account) => account.visibility < ACCOUNT_VISIBILITY.nowhere);
}

/** Accounts that feed the main dashboard and projection charts (visibility 0). */
export function dashboardAccounts(accounts: BankAccount[]): BankAccount[] {
  return accounts.filter((account) => account.visibility === ACCOUNT_VISIBILITY.everywhere);
}

/**
 * Resolves the effective account for an item. Labels always belong to an
 * account, so a labeled item is categorized under that account.
 */
export function resolveItemAccount(
  labelId: string | null | undefined,
  directAccountId: string | null | undefined,
  labels: ItemLabel[],
  accounts: BankAccount[]
): {
  accountId: string;
  accountName: string;
  accountColor: string;
  labelName?: string;
  labelColor?: string;
  isTiedViaLabel: boolean;
} {
  const fallbackAccount = accounts[0] || {
    id: 'unknown',
    name: '',
    color: '#64748b',
    visibility: ACCOUNT_VISIBILITY.everywhere,
  };

  const label = labelId ? labels.find((l) => l.id === labelId) : undefined;
  let targetAccountId: string | undefined;
  let isTiedViaLabel = false;

  if (label) {
    const tiedAcc = accounts.find((a) => a.id === label.accountId);
    if (tiedAcc) {
      targetAccountId = tiedAcc.id;
      isTiedViaLabel = true;
    }
  }

  if (!targetAccountId) {
    targetAccountId = directAccountId || fallbackAccount.id;
  }

  const account = accounts.find((a) => a.id === targetAccountId) || fallbackAccount;

  return {
    accountId: account.id,
    accountName: account.name,
    accountColor: account.color,
    labelName: label?.name,
    labelColor: label?.color,
    isTiedViaLabel,
  };
}

export type CatalogScope = {
  snapshotId: string | null;
  incomes: IncomeItem[];
  expenses: ExpenseItem[];
};

type CatalogLists = { incomes: IncomeItem[]; expenses: ExpenseItem[] };

function sortedSnapshots(house: House): CatalogSnapshot[] {
  return [...(house.catalogSnapshots ?? [])].sort((a, b) =>
    a.validUntil.localeCompare(b.validUntil)
  );
}

export function catalogScopeById(house: House, snapshotId?: string | null): CatalogScope {
  if (!snapshotId) {
    return { snapshotId: null, incomes: house.incomes, expenses: house.expenses };
  }

  const snapshot = (house.catalogSnapshots ?? []).find((item) => item.id === snapshotId);
  if (!snapshot) {
    return { snapshotId, incomes: [], expenses: [] };
  }

  return { snapshotId: snapshot.id, incomes: snapshot.incomes, expenses: snapshot.expenses };
}

/** Snapshot with the smallest validUntil that still covers `monthKey`, or the live table. */
export function catalogScopeForMonth(house: House, monthKey: string): CatalogScope {
  const match = sortedSnapshots(house).find((snapshot) => snapshot.validUntil >= monthKey);
  return match ? catalogScopeById(house, match.id) : catalogScopeById(house, null);
}

/** First month the live table covers, or null when it is valid indefinitely. */
export function mainCatalogValidFrom(house: House): string | null {
  const snapshots = sortedSnapshots(house);
  if (snapshots.length === 0) return null;
  return shiftMonthKey(snapshots[snapshots.length - 1].validUntil, 1);
}

export function latestCatalogValidUntil(house: House): string | null {
  const snapshots = sortedSnapshots(house);
  return snapshots.length === 0 ? null : snapshots[snapshots.length - 1].validUntil;
}

/** Inclusive bounds for moving a snapshot's validUntil. */
export function snapshotValidUntilBounds(
  house: House,
  snapshotId: string
): { minMonthKey?: string; maxMonthKey?: string } {
  const snapshots = sortedSnapshots(house);
  const index = snapshots.findIndex((snapshot) => snapshot.id === snapshotId);
  if (index < 0) return {};

  const previous = snapshots[index - 1];
  const next = snapshots[index + 1];
  return {
    minMonthKey: previous ? shiftMonthKey(previous.validUntil, 1) : undefined,
    maxMonthKey: next ? shiftMonthKey(next.validUntil, -1) : undefined,
  };
}

function catalogItems(lists: CatalogLists): Array<IncomeItem | ExpenseItem> {
  return [...lists.incomes, ...lists.expenses];
}

function catalogLineageKey(item: { id: string; sourceItemId?: string | null }): string {
  return item.sourceItemId || item.id;
}

export function buildCatalogIdMap(
  fromItems: Array<{ id: string; sourceItemId?: string | null }>,
  toItems: Array<{ id: string; sourceItemId?: string | null }>
): Map<string, string> {
  const toByLineage = new Map<string, string>();
  for (const item of toItems) {
    toByLineage.set(catalogLineageKey(item), item.id);
  }

  const map = new Map<string, string>();
  for (const item of fromItems) {
    const nextId = toByLineage.get(catalogLineageKey(item));
    if (nextId && nextId !== item.id) map.set(item.id, nextId);
  }
  return map;
}

export function remapMonthPlanItemIds(
  plan: MonthBudgetPlan,
  idMap: Map<string, string>
): MonthBudgetPlan {
  if (idMap.size === 0) return plan;

  const overrides: MonthBudgetPlan['overrides'] = {};
  for (const [itemId, override] of Object.entries(plan.overrides)) {
    const nextId = idMap.get(itemId) ?? itemId;
    overrides[nextId] = { ...override, originalItemId: nextId };
  }

  const settledItemIds: Record<string, boolean> = {};
  for (const [itemId, settled] of Object.entries(plan.settledItemIds)) {
    settledItemIds[idMap.get(itemId) ?? itemId] = settled;
  }

  const itemPositions: Record<string, number> = {};
  for (const [itemId, position] of Object.entries(plan.itemPositions)) {
    itemPositions[idMap.get(itemId) ?? itemId] = position;
  }

  return { ...plan, overrides, settledItemIds, itemPositions };
}

export function monthsOwnedBySnapshot(
  house: House,
  snapshotId: string
): { gt?: string; lte: string } | null {
  const snapshots = sortedSnapshots(house);
  const index = snapshots.findIndex((snapshot) => snapshot.id === snapshotId);
  if (index < 0) return null;

  const previous = snapshots[index - 1];
  return {
    gt: previous?.validUntil,
    lte: snapshots[index].validUntil,
  };
}

export function monthKeyInRange(monthKey: string, range: { gt?: string; lte: string }): boolean {
  if (range.gt && monthKey <= range.gt) return false;
  return monthKey <= range.lte;
}

function remapHousePlansInRange(
  house: House,
  range: { gt?: string; lte: string },
  idMap: Map<string, string>
): House {
  if (idMap.size === 0) return house;

  const monthlyPlans = { ...house.monthlyPlans };
  for (const [monthKey, plan] of Object.entries(monthlyPlans)) {
    if (!monthKeyInRange(monthKey, range)) continue;
    monthlyPlans[monthKey] = remapMonthPlanItemIds(plan, idMap);
  }
  return { ...house, monthlyPlans };
}

function withCatalogScope(
  house: House,
  snapshotId: string | null | undefined,
  fn: (lists: CatalogLists) => CatalogLists
): House {
  const id = snapshotId ?? null;
  if (!id) {
    const next = fn({ incomes: house.incomes, expenses: house.expenses });
    return { ...house, incomes: next.incomes, expenses: next.expenses };
  }

  return {
    ...house,
    catalogSnapshots: (house.catalogSnapshots ?? []).map((snapshot) => {
      if (snapshot.id !== id) return snapshot;
      const next = fn({ incomes: snapshot.incomes, expenses: snapshot.expenses });
      return { ...snapshot, incomes: next.incomes, expenses: next.expenses };
    }),
  };
}

export function applyLockCatalogToHouse(
  house: House,
  snapshot: CatalogSnapshot,
  copies: Array<{ sourceId: string; id: string }>
): House {
  const latest = latestCatalogValidUntil(house);
  const idMap = new Map(copies.map((copy) => [copy.sourceId, copy.id]));
  const idBySource = (sourceId: string, prefix: 'inc' | 'exp') =>
    idMap.get(sourceId) ?? `${prefix}-missing`;

  const locked: CatalogSnapshot = {
    ...snapshot,
    incomes: house.incomes.map((income) => ({
      ...income,
      id: idBySource(income.id, 'inc'),
      sourceItemId: income.id,
    })),
    expenses: house.expenses.map((expense) => ({
      ...expense,
      id: idBySource(expense.id, 'exp'),
      sourceItemId: expense.id,
    })),
  };

  const remapped = remapHousePlansInRange(
    house,
    { gt: latest ?? undefined, lte: snapshot.validUntil },
    idMap
  );

  return {
    ...remapped,
    catalogSnapshots: [...sortedSnapshots(remapped), locked],
  };
}

export function applySnapshotValidUntilToHouse(
  house: House,
  snapshotId: string,
  validUntil: string
): House {
  const snapshots = sortedSnapshots(house);
  const index = snapshots.findIndex((snapshot) => snapshot.id === snapshotId);
  const current = snapshots[index];
  if (!current || current.validUntil === validUntil) {
    return {
      ...house,
      catalogSnapshots: snapshots.map((snapshot) =>
        snapshot.id === snapshotId ? { ...snapshot, validUntil } : snapshot
      ),
    };
  }

  const nextSnapshot = snapshots[index + 1];
  const toScope = nextSnapshot
    ? catalogScopeById(house, nextSnapshot.id)
    : catalogScopeById(house, null);
  const fromScope = catalogScopeById(house, snapshotId);

  if (validUntil > current.validUntil) {
    const idMap = buildCatalogIdMap(catalogItems(toScope), catalogItems(fromScope));
    const remapped = remapHousePlansInRange(house, { gt: current.validUntil, lte: validUntil }, idMap);
    return {
      ...remapped,
      catalogSnapshots: sortedSnapshots(remapped).map((snapshot) =>
        snapshot.id === snapshotId ? { ...snapshot, validUntil } : snapshot
      ),
    };
  }

  const idMap = buildCatalogIdMap(catalogItems(fromScope), catalogItems(toScope));
  const remapped = remapHousePlansInRange(house, { gt: validUntil, lte: current.validUntil }, idMap);
  return {
    ...remapped,
    catalogSnapshots: sortedSnapshots(remapped).map((snapshot) =>
      snapshot.id === snapshotId ? { ...snapshot, validUntil } : snapshot
    ),
  };
}

export function applyDeleteSnapshotToHouse(house: House, snapshotId: string): House {
  const range = monthsOwnedBySnapshot(house, snapshotId);
  const snapshots = sortedSnapshots(house);
  const index = snapshots.findIndex((snapshot) => snapshot.id === snapshotId);
  const deleted = snapshots[index];
  if (!deleted || !range) {
    return { ...house, catalogSnapshots: snapshots.filter((snapshot) => snapshot.id !== snapshotId) };
  }

  const nextSnapshot = snapshots[index + 1];
  const toScope = nextSnapshot
    ? catalogScopeById(house, nextSnapshot.id)
    : catalogScopeById(house, null);
  const idMap = buildCatalogIdMap(catalogItems(deleted), catalogItems(toScope));
  const remapped = remapHousePlansInRange(house, range, idMap);

  return {
    ...remapped,
    catalogSnapshots: sortedSnapshots(remapped).filter((snapshot) => snapshot.id !== snapshotId),
  };
}

/**
 * Automatically synchronizes the budget plan for a month with the catalog version
 * that covers that month, taking into account monthly overrides and custom items.
 * Opening-balance corrections are applied in `getResolvedMonthlyBudgetPlan`.
 */
function resolveMonthItems(house: House, monthKey: string): ResolvedBudgetItem[] {
  const { month } = parseMonthKey(monthKey);
  const plan = house.monthlyPlans[monthKey] || {
    monthKey,
    overrides: {},
    customItems: [],
    settledItemIds: {},
    itemPositions: {},
  };
  const { incomes, expenses } = catalogScopeForMonth(house, monthKey);

  const resolvedItems: ResolvedBudgetItem[] = [];

  // 1. Process active Incomes
  incomes
    .filter((inc) => inc.isActive !== false)
    .forEach((inc) => {
      const override = plan.overrides[inc.id];
      const isOverridden = !!override;
      const effectiveName = override?.name ?? inc.name;
      const effectiveAmount = override?.amount ?? inc.amount;
      const effectiveDay = override?.day ?? inc.day;
      const effectiveLabelId = override?.labelId !== undefined ? override.labelId : inc.labelId;
      const effectiveAccountId = override?.accountId !== undefined ? override.accountId : inc.accountId;
      const isPaid = plan.settledItemIds[inc.id] ?? override?.isPaid ?? false;

      const accountResolution = resolveItemAccount(
        effectiveLabelId,
        effectiveAccountId,
        house.labels,
        house.accounts
      );

      resolvedItems.push({
        id: inc.id,
        originalItemId: inc.id,
        sourceType: 'synced_income',
        type: 'income',
        name: effectiveName,
        amount: effectiveAmount,
        originalAmount: inc.amount,
        day: effectiveDay,
        originalDay: inc.day,
        accountId: accountResolution.accountId,
        accountName: accountResolution.accountName,
        accountColor: accountResolution.accountColor,
        labelId: effectiveLabelId,
        labelName: accountResolution.labelName,
        labelColor: accountResolution.labelColor,
        isTiedViaLabel: accountResolution.isTiedViaLabel,
        isOverridden,
        isCustom: false,
        isPaid,
        notes: override?.notes ?? inc.notes,
      });
    });

  // 2. Process active Monthly Expenses
  expenses
    .filter((exp) => exp.isActive !== false && exp.frequency === 'monthly')
    .forEach((exp) => {
      const override = plan.overrides[exp.id];
      const isOverridden = !!override;
      const effectiveName = override?.name ?? exp.name;
      const effectiveAmount = override?.amount ?? exp.amount;
      const effectiveDay = override?.day ?? exp.day;
      const effectiveLabelId = override?.labelId !== undefined ? override.labelId : exp.labelId;
      const effectiveAccountId = override?.accountId !== undefined ? override.accountId : exp.accountId;
      const isPaid = plan.settledItemIds[exp.id] ?? override?.isPaid ?? false;

      const accountResolution = resolveItemAccount(
        effectiveLabelId,
        effectiveAccountId,
        house.labels,
        house.accounts
      );

      resolvedItems.push({
        id: exp.id,
        originalItemId: exp.id,
        sourceType: 'synced_monthly_expense',
        type: 'expense',
        name: effectiveName,
        amount: effectiveAmount,
        originalAmount: exp.amount,
        day: effectiveDay,
        originalDay: exp.day,
        accountId: accountResolution.accountId,
        accountName: accountResolution.accountName,
        accountColor: accountResolution.accountColor,
        labelId: effectiveLabelId,
        labelName: accountResolution.labelName,
        labelColor: accountResolution.labelColor,
        isTiedViaLabel: accountResolution.isTiedViaLabel,
        isOverridden,
        isCustom: false,
        isPaid,
        notes: override?.notes ?? exp.notes,
      });
    });

  // 3. Process active Annual Expenses that occur in this specific month
  expenses
    .filter(
      (exp) =>
        exp.isActive !== false &&
        exp.frequency === 'annual' &&
        exp.month === month
    )
    .forEach((exp) => {
      const override = plan.overrides[exp.id];
      const isOverridden = !!override;
      const effectiveName = override?.name ?? exp.name;
      const effectiveAmount = override?.amount ?? exp.amount;
      const effectiveDay = override?.day ?? exp.day;
      const effectiveLabelId = override?.labelId !== undefined ? override.labelId : exp.labelId;
      const effectiveAccountId = override?.accountId !== undefined ? override.accountId : exp.accountId;
      const isPaid = plan.settledItemIds[exp.id] ?? override?.isPaid ?? false;

      const accountResolution = resolveItemAccount(
        effectiveLabelId,
        effectiveAccountId,
        house.labels,
        house.accounts
      );

      resolvedItems.push({
        id: exp.id,
        originalItemId: exp.id,
        sourceType: 'synced_annual_expense',
        type: 'expense',
        name: effectiveName,
        amount: effectiveAmount,
        originalAmount: exp.amount,
        day: effectiveDay,
        originalDay: exp.day,
        accountId: accountResolution.accountId,
        accountName: accountResolution.accountName,
        accountColor: accountResolution.accountColor,
        labelId: effectiveLabelId,
        labelName: accountResolution.labelName,
        labelColor: accountResolution.labelColor,
        isTiedViaLabel: accountResolution.isTiedViaLabel,
        isOverridden,
        isCustom: false,
        isPaid,
        notes: override?.notes ?? exp.notes,
      });
    });

  // 4. Process Custom one-off items added to this month's budget plan
  (plan.customItems || []).forEach((custom) => {
    const isPaid = plan.settledItemIds[custom.id] ?? custom.isPaid ?? false;
    const accountResolution = resolveItemAccount(
      custom.labelId,
      custom.accountId,
      house.labels,
      house.accounts
    );

    resolvedItems.push({
      id: custom.id,
      sourceType: 'custom_item',
      type: custom.type,
      name: custom.name,
      amount: custom.amount,
      day: custom.day,
      accountId: accountResolution.accountId,
      accountName: accountResolution.accountName,
      accountColor: accountResolution.accountColor,
      labelId: custom.labelId,
      labelName: accountResolution.labelName,
      labelColor: accountResolution.labelColor,
      isTiedViaLabel: accountResolution.isTiedViaLabel,
      isOverridden: false,
      isCustom: true,
      isPaid,
      notes: custom.notes,
    });
  });

  return resolvedItems;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function monthEndBalances(
  house: House,
  monthKey: string,
  openings: Record<string, number>
): Record<string, number> {
  const balances: Record<string, number> = { ...openings };
  for (const item of resolveMonthItems(house, monthKey)) {
    const delta = item.type === 'income' ? item.amount : -item.amount;
    balances[item.accountId] = roundMoney((balances[item.accountId] ?? 0) + delta);
  }
  return balances;
}

export const OPENING_CORRECTION_PREFIX = 'opening:';

export function openingCorrectionId(accountId: string): string {
  return `${OPENING_CORRECTION_PREFIX}${accountId}`;
}

export function isOpeningCorrectionId(itemId: string): boolean {
  return itemId.startsWith(OPENING_CORRECTION_PREFIX);
}

export type AccountOpeningBalance = {
  carried: number;
  set?: number;
  effective: number;
  correction: number;
};

/** Per-account opening for a month: carried from the previous month, optional override, and the delta. */
export function getMonthOpeningBalances(
  house: House,
  monthKey: string
): Record<string, AccountOpeningBalance> {
  const prevKey = shiftMonthKey(monthKey, -1);
  const prevStored = house.monthlyPlans[prevKey]?.openingBalances ?? {};
  const prevEnd = monthEndBalances(house, prevKey, prevStored);
  const stored = house.monthlyPlans[monthKey]?.openingBalances ?? {};

  const result: Record<string, AccountOpeningBalance> = {};
  for (const account of house.accounts) {
    const carried = roundMoney(prevEnd[account.id] ?? 0);
    const hasSet = Object.prototype.hasOwnProperty.call(stored, account.id);
    const set = hasSet ? stored[account.id] : undefined;
    const effective = set !== undefined ? set : carried;
    result[account.id] = {
      carried,
      set,
      effective,
      correction: roundMoney(effective - carried),
    };
  }
  return result;
}

export function getResolvedMonthlyBudgetPlan(
  house: House,
  monthKey: string
): ResolvedBudgetItem[] {
  const items = resolveMonthItems(house, monthKey);
  const plan = house.monthlyPlans[monthKey];
  const openings = getMonthOpeningBalances(house, monthKey);
  const corrections: ResolvedBudgetItem[] = [];

  for (const account of house.accounts) {
    const opening = openings[account.id];
    if (!opening || opening.correction === 0) continue;

    const resolution = resolveItemAccount(null, account.id, house.labels, house.accounts);
    corrections.push({
      id: openingCorrectionId(account.id),
      sourceType: 'opening_correction',
      type: opening.correction > 0 ? 'income' : 'expense',
      name: account.name,
      amount: Math.abs(opening.correction),
      day: 0,
      accountId: resolution.accountId,
      accountName: resolution.accountName,
      accountColor: resolution.accountColor,
      isTiedViaLabel: false,
      isOverridden: false,
      isCustom: false,
      isPaid: false,
    });
  }

  return [...corrections, ...items].sort((a, b) =>
    compareResolvedPlanItems(a, b, plan?.itemPositions ?? {})
  );
}

const UNORDERED_POSITION = Number.MAX_SAFE_INTEGER;

/** Canonical month order: day, saved position, income before expense, name. */
export function compareResolvedPlanItems(
  a: ResolvedBudgetItem,
  b: ResolvedBudgetItem,
  itemPositions: Record<string, number> = {}
): number {
  if (a.day !== b.day) return a.day - b.day;
  const posA = itemPositions[a.id] ?? UNORDERED_POSITION;
  const posB = itemPositions[b.id] ?? UNORDERED_POSITION;
  if (posA !== posB) return posA - posB;
  if (a.type !== b.type) return a.type === 'income' ? -1 : 1;
  const nameOrder = a.name.localeCompare(b.name, 'en');
  if (nameOrder !== 0) return nameOrder;
  return a.id.localeCompare(b.id);
}

export function toItemPositions(orderedIds: string[]): Record<string, number> {
  return Object.fromEntries(orderedIds.map((id, index) => [id, index]));
}

function moveIdInList(
  ids: string[],
  draggedId: string,
  targetId: string,
  place: 'before' | 'after'
): string[] {
  if (draggedId === targetId) return ids;
  const next = ids.filter((id) => id !== draggedId);
  const targetIndex = next.indexOf(targetId);
  if (targetIndex < 0) return ids;
  next.splice(place === 'after' ? targetIndex + 1 : targetIndex, 0, draggedId);
  return next;
}

export function orderedIdsAfterGroupedMove<T extends { id: string }>(
  items: T[],
  draggedId: string,
  targetId: string,
  place: 'before' | 'after',
  groupOf: (item: T) => string
): string[] | null {
  const dragged = items.find((item) => item.id === draggedId);
  const target = items.find((item) => item.id === targetId);
  if (!dragged || !target) return null;
  const group = groupOf(dragged);
  if (group !== groupOf(target)) return null;

  const groupIds = items.filter((item) => groupOf(item) === group).map((item) => item.id);
  const movedGroupIds = moveIdInList(groupIds, draggedId, targetId, place);
  if (movedGroupIds.join('\0') === groupIds.join('\0')) return null;

  const next: string[] = [];
  let inserted = false;
  for (const item of items) {
    if (groupOf(item) !== group) {
      next.push(item.id);
      continue;
    }
    if (!inserted) {
      next.push(...movedGroupIds);
      inserted = true;
    }
  }
  return next;
}

/** Reorder within the same day, then splice that day back into the full list. */
export function orderedIdsAfterMove(
  items: ResolvedBudgetItem[],
  draggedId: string,
  targetId: string,
  place: 'before' | 'after'
): string[] | null {
  return orderedIdsAfterGroupedMove(items, draggedId, targetId, place, (item) => String(item.day));
}

export const CATALOG_KIND_META: Record<
  CatalogKind,
  { badgeClassName: string; color: string }
> = {
  monthly_income: {
    badgeClassName: 'text-emerald-700 bg-emerald-50',
    color: '#34d399',
  },
  monthly_expense: {
    badgeClassName: 'text-slate-600 bg-slate-100',
    color: '#fb7185',
  },
  annual_expense: {
    badgeClassName: 'text-amber-800 bg-amber-50 border border-amber-200/40',
    color: '#f59e0b',
  },
};

const CATALOG_KIND_RANK: Record<CatalogKind, number> = {
  monthly_income: 0,
  monthly_expense: 1,
  annual_expense: 2,
};

export function catalogKindOfExpense(expense: Pick<ExpenseItem, 'frequency'>): CatalogKind {
  return expense.frequency === 'annual' ? 'annual_expense' : 'monthly_expense';
}

export function catalogDateKey(item: Pick<CatalogItem, 'day' | 'month' | 'kind'>): string {
  if (item.kind === 'annual_expense') return `${item.day}.${item.month ?? 1}`;
  return `${item.day}.*`;
}

export function catalogDateSortValue(item: Pick<CatalogItem, 'day' | 'month' | 'kind'>): number {
  const monthPart = item.kind === 'annual_expense' ? item.month ?? 1 : 0;
  return item.day * 100 + monthPart;
}

export function incomeToCatalogItem(income: IncomeItem): CatalogItem {
  return {
    id: income.id,
    kind: 'monthly_income',
    name: income.name,
    amount: income.amount,
    day: income.day,
    labelId: income.labelId,
    accountId: income.accountId,
    notes: income.notes,
    isActive: income.isActive,
    position: income.position,
  };
}

export function expenseToCatalogItem(expense: ExpenseItem): CatalogItem {
  return {
    id: expense.id,
    kind: catalogKindOfExpense(expense),
    name: expense.name,
    amount: expense.amount,
    day: expense.day,
    month: expense.month,
    labelId: expense.labelId,
    accountId: expense.accountId,
    notes: expense.notes,
    isActive: expense.isActive,
    position: expense.position,
  };
}

export function catalogItemToIncome(
  item: CatalogItem,
  sourceItemId?: string | null
): IncomeItem {
  return {
    id: item.id,
    name: item.name,
    amount: Math.abs(item.amount),
    day: item.day,
    labelId: item.labelId,
    accountId: item.accountId,
    notes: item.notes,
    isActive: item.isActive ?? true,
    position: item.position,
    sourceItemId: sourceItemId ?? null,
  };
}

export function catalogItemToExpense(
  item: CatalogItem,
  sourceItemId?: string | null
): ExpenseItem {
  const annual = item.kind === 'annual_expense';
  return {
    id: item.id,
    name: item.name,
    amount: item.amount,
    day: item.day,
    frequency: annual ? 'annual' : 'monthly',
    month: annual ? item.month ?? 1 : undefined,
    labelId: item.labelId,
    accountId: item.accountId,
    notes: item.notes,
    isActive: item.isActive ?? true,
    position: item.position,
    sourceItemId: sourceItemId ?? null,
  };
}

export function getCatalogRows(house: House, scope?: CatalogScope): CatalogRow[] {
  const lists = scope ?? catalogScopeById(house, null);
  const rows: CatalogRow[] = [
    ...lists.incomes.map((income) => toCatalogRow(house, incomeToCatalogItem(income))),
    ...lists.expenses.map((expense) => toCatalogRow(house, expenseToCatalogItem(expense))),
  ];

  return rows.sort(compareCatalogRows);
}

function toCatalogRow(house: House, item: CatalogItem): CatalogRow {
  const resolved = resolveItemAccount(item.labelId, item.accountId, house.labels, house.accounts);
  return {
    ...item,
    accountId: resolved.accountId,
    accountName: resolved.accountName,
    accountColor: resolved.accountColor,
    labelName: resolved.labelName,
    labelColor: resolved.labelColor,
    isTiedViaLabel: resolved.isTiedViaLabel,
  };
}

export function compareCatalogRows(a: CatalogRow, b: CatalogRow): number {
  const dateOrder = catalogDateSortValue(a) - catalogDateSortValue(b);
  if (dateOrder !== 0) return dateOrder;
  const posA = a.position ?? UNORDERED_POSITION;
  const posB = b.position ?? UNORDERED_POSITION;
  if (posA !== posB) return posA - posB;
  const kindOrder = CATALOG_KIND_RANK[a.kind] - CATALOG_KIND_RANK[b.kind];
  if (kindOrder !== 0) return kindOrder;
  const nameOrder = a.name.localeCompare(b.name, 'en');
  if (nameOrder !== 0) return nameOrder;
  return a.id.localeCompare(b.id);
}

export function mapAllCatalogItems(
  house: House,
  mapIncome: (item: IncomeItem) => IncomeItem,
  mapExpense: (item: ExpenseItem) => ExpenseItem
): House {
  return {
    ...house,
    incomes: house.incomes.map(mapIncome),
    expenses: house.expenses.map(mapExpense),
    catalogSnapshots: (house.catalogSnapshots ?? []).map((snapshot) => ({
      ...snapshot,
      incomes: snapshot.incomes.map(mapIncome),
      expenses: snapshot.expenses.map(mapExpense),
    })),
  };
}

function applyCatalogItemToLists(
  lists: CatalogLists,
  item: CatalogItem,
  previousKind?: CatalogKind
): CatalogLists {
  const existingIncome = lists.incomes.find((income) => income.id === item.id);
  const existingExpense = lists.expenses.find((expense) => expense.id === item.id);
  const existingSource = existingIncome?.sourceItemId ?? existingExpense?.sourceItemId ?? null;
  const existingPosition = existingIncome?.position ?? existingExpense?.position;
  const nextPosition =
    item.position ??
    existingPosition ??
    Math.max(
      -1,
      ...lists.incomes.map((income) => income.position ?? -1),
      ...lists.expenses.map((expense) => expense.position ?? -1)
    ) + 1;
  const saved: CatalogItem = { ...item, position: nextPosition, isActive: item.isActive ?? true };

  let incomes = lists.incomes.filter((income) => income.id !== saved.id);
  let expenses = lists.expenses.filter((expense) => expense.id !== saved.id);

  if (saved.kind === 'monthly_income') {
    const asIncome = catalogItemToIncome(saved, existingSource);
    if (previousKind === 'monthly_income' && existingIncome) {
      incomes = lists.incomes.map((income) => (income.id === saved.id ? asIncome : income));
    } else {
      incomes = [...incomes, asIncome];
    }
  } else {
    const asExpense = catalogItemToExpense(saved, existingSource);
    if (previousKind && previousKind !== 'monthly_income' && existingExpense) {
      expenses = lists.expenses.map((expense) => (expense.id === saved.id ? asExpense : expense));
    } else {
      expenses = [...expenses, asExpense];
    }
  }

  return { incomes, expenses };
}

export function applyCatalogItemToHouse(
  house: House,
  item: CatalogItem,
  previousKind?: CatalogKind,
  snapshotId?: string | null
): House {
  return withCatalogScope(house, snapshotId, (lists) =>
    applyCatalogItemToLists(lists, item, previousKind)
  );
}

function applyCatalogOrderToLists(lists: CatalogLists, orderedIds: string[]): CatalogLists {
  const incomesById = new Map(lists.incomes.map((income) => [income.id, income]));
  const expensesById = new Map(lists.expenses.map((expense) => [expense.id, expense]));
  const incomes: IncomeItem[] = [];
  const expenses: ExpenseItem[] = [];
  const seen = new Set<string>();

  orderedIds.forEach((id, position) => {
    const income = incomesById.get(id);
    if (income) {
      incomes.push({ ...income, position });
      seen.add(id);
      return;
    }
    const expense = expensesById.get(id);
    if (expense) {
      expenses.push({ ...expense, position });
      seen.add(id);
    }
  });

  lists.incomes.forEach((income) => {
    if (!seen.has(income.id)) incomes.push(income);
  });
  lists.expenses.forEach((expense) => {
    if (!seen.has(expense.id)) expenses.push(expense);
  });

  return { incomes, expenses };
}

export function applyCatalogOrderToHouse(
  house: House,
  orderedIds: string[],
  snapshotId?: string | null
): House {
  return withCatalogScope(house, snapshotId, (lists) => applyCatalogOrderToLists(lists, orderedIds));
}

export function removeCatalogItemFromHouse(
  house: House,
  itemId: string,
  snapshotId?: string | null
): House {
  return withCatalogScope(house, snapshotId, (lists) => ({
    incomes: lists.incomes.filter((income) => income.id !== itemId),
    expenses: lists.expenses.filter((expense) => expense.id !== itemId),
  }));
}

export function orderedIdsAfterInsert(
  currentIds: string[],
  newItemId: string,
  placement?: { beforeId?: string; afterId?: string }
): string[] {
  const ids = currentIds.filter((id) => id !== newItemId);
  if (placement?.beforeId) {
    const index = ids.indexOf(placement.beforeId);
    if (index >= 0) {
      ids.splice(index, 0, newItemId);
      return ids;
    }
  }
  if (placement?.afterId) {
    const index = ids.indexOf(placement.afterId);
    if (index >= 0) {
      ids.splice(index + 1, 0, newItemId);
      return ids;
    }
  }
  ids.push(newItemId);
  return ids;
}

/**
 * Running balance of each item's own account after that item, computed over
 * the full (unfiltered) month in canonical chronological order.
 */
export function computeAccountRunningBalances(
  items: ResolvedBudgetItem[],
  openingBalances: Record<string, number> = {}
): Record<string, number> {
  const balances: Record<string, number> = {};
  const runningByAccount: Record<string, number> = { ...openingBalances };

  items.forEach((item) => {
    const previous = runningByAccount[item.accountId] ?? 0;
    const delta = item.type === 'income' ? item.amount : -item.amount;
    const next = Math.round((previous + delta) * 100) / 100;
    runningByAccount[item.accountId] = next;
    balances[item.id] = next;
  });

  return balances;
}

export type CashFlowAsOf = {
  monthKey: string;
  /** 0 means "before any day in this month" (the opening). */
  day: number;
};

export type AccountCashFlowRow = {
  accountId: string;
  opening: number;
  current: number;
  projectedEnd: number;
  netFlow: number;
};

export type CashFlowSummary = {
  startingTotalBalance: number;
  currentDayBalance: number;
  projectedEndBalance: number;
  totalInflow: number;
  totalOutflow: number;
  netCashFlow: number;
  regularIncome: number;
  regularExpense: number;
  customNetUnpaid: number;
  customNetAll: number;
  byAccount: AccountCashFlowRow[];
};

function copyBalances(
  source: Record<string, number>,
  accountIds: string[]
): Record<string, number> {
  const next: Record<string, number> = {};
  for (const id of accountIds) {
    next[id] = source[id] ?? 0;
  }
  return next;
}

function sumBalances(source: Record<string, number>, accountIds: string[]): number {
  return roundMoney(accountIds.reduce((sum, id) => sum + (source[id] ?? 0), 0));
}

function itemSignedAmount(item: ResolvedBudgetItem): number {
  return item.type === 'income' ? item.amount : -item.amount;
}

/** Today if it falls in the range; otherwise the start (future) or end (past). */
export function effectiveAsOf(
  rangeStartMonthKey: string,
  rangeEndMonthKey: string,
  todayMonthKey: string,
  todayDay: number
): CashFlowAsOf {
  if (todayMonthKey < rangeStartMonthKey) {
    return { monthKey: rangeStartMonthKey, day: 0 };
  }
  if (todayMonthKey > rangeEndMonthKey) {
    const { year, month } = parseMonthKey(rangeEndMonthKey);
    return { monthKey: rangeEndMonthKey, day: getDaysInMonth(year, month) };
  }
  return { monthKey: todayMonthKey, day: todayDay };
}

/**
 * Daily running balances for each requested account across a month range.
 * The first month starts from `getMonthOpeningBalances`; later months roll the
 * previous end forward and apply a stored opening as a reset when one exists.
 * Opening-correction plan rows are not replayed as transactions.
 */
export function computeCashFlowRange(
  house: House,
  fromMonthKey: string,
  toMonthKey: string,
  accountIds: string[]
): {
  points: CashFlowPoint[];
  openingByAccount: Record<string, number>;
} {
  const accountIdSet = new Set(accountIds);
  const firstOpenings = getMonthOpeningBalances(house, fromMonthKey);
  const openingByAccount: Record<string, number> = {};
  for (const id of accountIds) {
    openingByAccount[id] = roundMoney(firstOpenings[id]?.effective ?? 0);
  }

  const running = copyBalances(openingByAccount, accountIds);
  const points: CashFlowPoint[] = [];
  let index = 0;

  for (
    let monthKey = fromMonthKey;
    monthKey <= toMonthKey;
    monthKey = shiftMonthKey(monthKey, 1)
  ) {
    if (monthKey !== fromMonthKey) {
      const stored = house.monthlyPlans[monthKey]?.openingBalances ?? {};
      for (const id of accountIds) {
        if (Object.prototype.hasOwnProperty.call(stored, id)) {
          running[id] = roundMoney(stored[id]);
        }
      }
    }

    const { year, month } = parseMonthKey(monthKey);
    const daysInMonth = getDaysInMonth(year, month);
    const monthItems = resolveMonthItems(house, monthKey).filter((item) =>
      accountIdSet.has(item.accountId)
    );

    for (let day = 1; day <= daysInMonth; day++) {
      const dayItems = monthItems.filter((item) => item.day === day);
      const flowByAccount: Record<string, number> = {};
      for (const id of accountIds) flowByAccount[id] = 0;

      for (const item of dayItems) {
        const delta = itemSignedAmount(item);
        flowByAccount[item.accountId] = roundMoney((flowByAccount[item.accountId] ?? 0) + delta);
        running[item.accountId] = roundMoney((running[item.accountId] ?? 0) + delta);
      }

      points.push({
        monthKey,
        day,
        index,
        dateStr: `${day}. ${month}. ${year}`,
        balanceByAccount: copyBalances(running, accountIds),
        flowByAccount,
        items: dayItems,
      });
      index += 1;
    }
  }

  return { points, openingByAccount };
}

export function summarizeCashFlow(
  points: CashFlowPoint[],
  openingByAccount: Record<string, number>,
  accountIds: string[],
  asOf: CashFlowAsOf
): CashFlowSummary {
  const accountIdSet = new Set(accountIds);
  const startingTotalBalance = sumBalances(openingByAccount, accountIds);
  const lastPoint = points[points.length - 1];
  const projectedEndByAccount = lastPoint?.balanceByAccount ?? openingByAccount;
  const projectedEndBalance = sumBalances(projectedEndByAccount, accountIds);

  let currentByAccount = openingByAccount;
  if (asOf.day > 0) {
    const match =
      points.find((point) => point.monthKey === asOf.monthKey && point.day === asOf.day) ??
      [...points]
        .reverse()
        .find((point) => point.monthKey === asOf.monthKey && point.day <= asOf.day) ??
      lastPoint;
    if (match) currentByAccount = match.balanceByAccount;
  }

  const currentDayBalance = sumBalances(currentByAccount, accountIds);

  let totalInflow = 0;
  let totalOutflow = 0;
  let regularIncome = 0;
  let regularExpense = 0;
  let customNetUnpaid = 0;
  let customNetAll = 0;

  for (const point of points) {
    for (const item of point.items) {
      if (!accountIdSet.has(item.accountId)) continue;

      if (item.type === 'income') totalInflow += item.amount;
      else totalOutflow += item.amount;

      const signed = itemSignedAmount(item);
      if (item.sourceType === 'custom_item') {
        customNetAll += signed;
        if (!item.isPaid) customNetUnpaid += signed;
      } else if (item.sourceType === 'synced_income') {
        regularIncome += item.amount;
      } else if (
        item.sourceType === 'synced_monthly_expense' ||
        item.sourceType === 'synced_annual_expense'
      ) {
        regularExpense += item.amount;
      }
    }
  }

  return {
    startingTotalBalance,
    currentDayBalance,
    projectedEndBalance,
    totalInflow: roundMoney(totalInflow),
    totalOutflow: roundMoney(totalOutflow),
    netCashFlow: roundMoney(totalInflow - totalOutflow),
    regularIncome: roundMoney(regularIncome),
    regularExpense: roundMoney(regularExpense),
    customNetUnpaid: roundMoney(customNetUnpaid),
    customNetAll: roundMoney(customNetAll),
    byAccount: accountIds.map((accountId) => {
      const opening = roundMoney(openingByAccount[accountId] ?? 0);
      const projectedEnd = roundMoney(projectedEndByAccount[accountId] ?? 0);
      return {
        accountId,
        opening,
        current: roundMoney(currentByAccount[accountId] ?? 0),
        projectedEnd,
        netFlow: roundMoney(projectedEnd - opening),
      };
    }),
  };
}
