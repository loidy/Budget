import type { Prisma } from '../generated/prisma/client';
import { prisma } from './prisma';
import type {
  BankAccount,
  BudgetItemOverride,
  CatalogSnapshot,
  ExpenseItem,
  House,
  IncomeItem,
  ItemLabel,
  MonthBudgetPlan,
} from '../types';
import { catalogViewFromRecord } from './catalogView';

export const houseInclude = {
  accounts: { orderBy: [{ position: 'asc' }, { name: 'asc' }] },
  labels: { orderBy: [{ position: 'asc' }, { name: 'asc' }] },
  incomes: { where: { snapshotId: null }, orderBy: [{ position: 'asc' }, { day: 'asc' }] },
  expenses: { where: { snapshotId: null }, orderBy: [{ position: 'asc' }, { day: 'asc' }] },
  catalogSnapshots: {
    include: {
      incomes: { orderBy: [{ position: 'asc' }, { day: 'asc' }] },
      expenses: { orderBy: [{ position: 'asc' }, { day: 'asc' }] },
    },
    orderBy: { validUntil: 'asc' },
  },
  monthPlans: {
    include: {
      overrides: true,
      customItems: true,
      settledItems: true,
      itemOrders: { orderBy: { position: 'asc' } },
      openingBalances: true,
    },
  },
  members: {
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: 'asc' },
  },
  catalogTableViews: { orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] },
} satisfies Prisma.HouseInclude;

type HouseRecord = Prisma.HouseGetPayload<{ include: typeof houseInclude }>;
type MonthPlanRecord = HouseRecord['monthPlans'][number];

/** Prisma returns Decimal objects; the UI works with plain numbers. */
function toNumber(value: Prisma.Decimal): number {
  return Number(value);
}

function orUndefined<T>(value: T | null): T | undefined {
  return value ?? undefined;
}

function toAccount(record: HouseRecord['accounts'][number]): BankAccount {
  const visibility = record.visibility === 1 || record.visibility === 2 ? record.visibility : 0;
  return {
    id: record.id,
    name: record.name,
    color: record.color,
    visibility,
  };
}

function toLabel(record: HouseRecord['labels'][number]): ItemLabel {
  return {
    id: record.id,
    name: record.name,
    color: record.color,
    accountId: record.accountId,
  };
}

function toIncome(record: HouseRecord['incomes'][number]): IncomeItem {
  return {
    id: record.id,
    name: record.name,
    amount: toNumber(record.amount),
    day: record.day,
    labelId: record.labelId,
    accountId: record.accountId,
    notes: orUndefined(record.notes),
    isActive: record.isActive,
    position: record.position,
    sourceItemId: record.sourceItemId,
  };
}

function toExpense(record: HouseRecord['expenses'][number]): ExpenseItem {
  return {
    id: record.id,
    name: record.name,
    amount: toNumber(record.amount),
    day: record.day,
    frequency: record.frequency,
    month: orUndefined(record.month),
    labelId: record.labelId,
    accountId: record.accountId,
    notes: orUndefined(record.notes),
    isActive: record.isActive,
    position: record.position,
    sourceItemId: record.sourceItemId,
  };
}

function toCatalogSnapshot(
  record: HouseRecord['catalogSnapshots'][number]
): CatalogSnapshot {
  return {
    id: record.id,
    validUntil: record.validUntil,
    createdAt: record.createdAt.toISOString(),
    incomes: record.incomes.map(toIncome),
    expenses: record.expenses.map(toExpense),
  };
}

function toOverride(record: MonthPlanRecord['overrides'][number]): BudgetItemOverride {
  return {
    id: record.id,
    originalItemId: record.originalItemId,
    isCustom: false,
    type: record.type,
    name: record.name,
    amount: toNumber(record.amount),
    day: record.day,
    accountId: record.accountId ?? '',
    labelId: record.labelId,
    isPaid: orUndefined(record.isPaid),
    notes: orUndefined(record.notes),
  };
}

function toCustomItem(record: MonthPlanRecord['customItems'][number]): BudgetItemOverride {
  return {
    id: record.id,
    isCustom: true,
    type: record.type,
    name: record.name,
    amount: toNumber(record.amount),
    day: record.day,
    accountId: record.accountId ?? '',
    labelId: record.labelId,
    isPaid: record.isPaid,
    notes: orUndefined(record.notes),
  };
}

function toMonthPlan(record: MonthPlanRecord): MonthBudgetPlan {
  const overrides: Record<string, BudgetItemOverride> = {};
  for (const override of record.overrides) {
    overrides[override.originalItemId] = toOverride(override);
  }

  const settledItemIds: Record<string, boolean> = {};
  for (const settled of record.settledItems) {
    settledItemIds[settled.itemId] = settled.settled;
  }

  const itemPositions: Record<string, number> = {};
  for (const order of record.itemOrders) {
    itemPositions[order.itemId] = order.position;
  }

  const openingBalances: Record<string, number> = {};
  for (const opening of record.openingBalances) {
    openingBalances[opening.accountId] = toNumber(opening.amount);
  }

  return {
    monthKey: record.monthKey,
    overrides,
    customItems: record.customItems.map(toCustomItem),
    settledItemIds,
    itemPositions,
    openingBalances,
  };
}

export function toHouse(record: HouseRecord, userId: string): House {
  const monthlyPlans: Record<string, MonthBudgetPlan> = {};
  for (const plan of record.monthPlans) {
    monthlyPlans[plan.monthKey] = toMonthPlan(plan);
  }

  return {
    id: record.id,
    name: record.name,
    description: orUndefined(record.description),
    icon: record.icon,
    role: record.ownerId === userId ? 'owner' : 'member',
    members: record.members.map((member) => ({
      userId: member.user.id,
      name: member.user.name,
      email: member.user.email,
    })),
    accounts: record.accounts.map(toAccount),
    labels: record.labels.map(toLabel),
    incomes: record.incomes.map(toIncome),
    expenses: record.expenses.map(toExpense),
    monthlyPlans,
    catalogSnapshots: record.catalogSnapshots.map(toCatalogSnapshot),
    catalogTableViews: record.catalogTableViews.map((view) => ({
      id: view.id,
      name: view.name,
      position: view.position,
      view: catalogViewFromRecord(view),
    })),
  };
}

/** Loads houses the user owns or has been shared, shaped like the UI `House` type. */
export async function getHouses(userId: string): Promise<House[]> {
  const records = await prisma.house.findMany({
    where: {
      OR: [{ ownerId: userId }, { members: { some: { userId } } }],
    },
    include: houseInclude,
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
  });

  return records.map((record) => toHouse(record, userId));
}
