'use server';

import { revalidatePath } from 'next/cache';
import { errorText } from '../i18n/fail';
import { requireHouseAccess } from '../lib/auth-guard';
import { prisma } from '../lib/prisma';
import {
  CATALOG_KINDS,
  type CatalogItem,
  type CatalogKind,
  type ExpenseFrequency,
  type ExpenseItem,
  type IncomeItem,
} from '../types';
import { catalogItemToExpense, catalogItemToIncome } from '../utils/budgetLogic';
import * as v from '../lib/validation';

const FREQUENCIES = ['monthly', 'annual'] as const satisfies readonly ExpenseFrequency[];

function incomeFields(income: IncomeItem) {
  return {
    name: v.text(income.name, 'name'),
    amount: v.amount(income.amount),
    day: v.day(income.day),
    labelId: v.optionalId(income.labelId),
    accountId: v.optionalId(income.accountId),
    notes: v.optionalText(income.notes),
    isActive: v.boolean(income.isActive, true),
  };
}

function expenseFields(expense: ExpenseItem) {
  const frequency = v.enumValue(expense.frequency, FREQUENCIES, 'frequency');

  return {
    name: v.text(expense.name, 'name'),
    amount: v.amount(expense.amount),
    day: v.day(expense.day),
    frequency,
    month: frequency === 'annual' ? (v.monthNumber(expense.month) ?? 1) : null,
    labelId: v.optionalId(expense.labelId),
    accountId: v.optionalId(expense.accountId),
    notes: v.optionalText(expense.notes),
    isActive: v.boolean(expense.isActive, true),
  };
}

function isIncomeKind(kind: CatalogKind) {
  return kind === 'monthly_income';
}

function snapshotFilter(snapshotId?: string | null) {
  return { snapshotId: snapshotId ?? null };
}

async function requireCatalogSnapshot(
  houseId: string,
  snapshotId?: string | null
): Promise<string | null> {
  if (!snapshotId) return null;
  const scopedSnapshotId = v.id(snapshotId, 'snapshotId');
  const found = await prisma.catalogSnapshot.findFirst({
    where: { id: scopedSnapshotId, houseId },
    select: { id: true },
  });
  if (!found) {
    throw new v.ValidationError(await errorText('snapshotNotInHouse'));
  }
  return scopedSnapshotId;
}

async function nextCatalogPosition(houseId: string, snapshotId?: string | null): Promise<number> {
  const where = { houseId, ...snapshotFilter(snapshotId) };
  const [incomeMax, expenseMax] = await Promise.all([
    prisma.income.aggregate({ where, _max: { position: true } }),
    prisma.expense.aggregate({ where, _max: { position: true } }),
  ]);

  return Math.max(incomeMax._max.position ?? -1, expenseMax._max.position ?? -1) + 1;
}

export async function createIncome(houseId: string, income: IncomeItem): Promise<void> {
  const { houseId: scopedHouseId } = await requireHouseAccess(houseId);
  const position = await nextCatalogPosition(scopedHouseId);

  await prisma.income.create({
    data: {
      id: v.id(income.id, 'id'),
      houseId: scopedHouseId,
      position,
      ...incomeFields(income),
    },
  });

  revalidatePath('/');
}

export async function updateIncome(houseId: string, income: IncomeItem): Promise<void> {
  const { houseId: scopedHouseId } = await requireHouseAccess(houseId);
  await prisma.income.updateMany({
    where: { id: v.id(income.id, 'id'), houseId: scopedHouseId },
    data: incomeFields(income),
  });

  revalidatePath('/');
}

export async function deleteIncome(houseId: string, incomeId: string): Promise<void> {
  const { houseId: scopedHouseId } = await requireHouseAccess(houseId);
  await prisma.income.deleteMany({
    where: { id: v.id(incomeId, 'incomeId'), houseId: scopedHouseId },
  });

  revalidatePath('/');
}

export async function createExpense(houseId: string, expense: ExpenseItem): Promise<void> {
  const { houseId: scopedHouseId } = await requireHouseAccess(houseId);
  const position = await nextCatalogPosition(scopedHouseId);

  await prisma.expense.create({
    data: {
      id: v.id(expense.id, 'id'),
      houseId: scopedHouseId,
      position,
      ...expenseFields(expense),
    },
  });

  revalidatePath('/');
}

export async function updateExpense(houseId: string, expense: ExpenseItem): Promise<void> {
  const { houseId: scopedHouseId } = await requireHouseAccess(houseId);
  await prisma.expense.updateMany({
    where: { id: v.id(expense.id, 'id'), houseId: scopedHouseId },
    data: expenseFields(expense),
  });

  revalidatePath('/');
}

export async function deleteExpense(houseId: string, expenseId: string): Promise<void> {
  const { houseId: scopedHouseId } = await requireHouseAccess(houseId);
  await prisma.expense.deleteMany({
    where: { id: v.id(expenseId, 'expenseId'), houseId: scopedHouseId },
  });

  revalidatePath('/');
}

export async function saveCatalogItem(
  houseId: string,
  item: CatalogItem,
  previousKind?: CatalogKind,
  snapshotId?: string | null
): Promise<void> {
  const { houseId: scopedHouseId } = await requireHouseAccess(houseId);
  const kind = v.enumValue(item.kind, CATALOG_KINDS, 'kind');
  const id = v.id(item.id, 'id');
  const scopedSnapshotId = await requireCatalogSnapshot(scopedHouseId, snapshotId);
  const saved: CatalogItem = { ...item, id, kind };
  const scope = snapshotFilter(scopedSnapshotId);

  if (!previousKind) {
    const position = await nextCatalogPosition(scopedHouseId, scopedSnapshotId);
    if (isIncomeKind(kind)) {
      await prisma.income.create({
        data: {
          id,
          houseId: scopedHouseId,
          snapshotId: scopedSnapshotId,
          sourceItemId: null,
          position,
          ...incomeFields(catalogItemToIncome(saved)),
        },
      });
    } else {
      await prisma.expense.create({
        data: {
          id,
          houseId: scopedHouseId,
          snapshotId: scopedSnapshotId,
          sourceItemId: null,
          position,
          ...expenseFields(catalogItemToExpense(saved)),
        },
      });
    }
    revalidatePath('/');
    return;
  }

  const prev = v.enumValue(previousKind, CATALOG_KINDS, 'previousKind');

  if (isIncomeKind(prev) && isIncomeKind(kind)) {
    await prisma.income.updateMany({
      where: { id, houseId: scopedHouseId, ...scope },
      data: incomeFields(catalogItemToIncome(saved)),
    });
  } else if (!isIncomeKind(prev) && !isIncomeKind(kind)) {
    await prisma.expense.updateMany({
      where: { id, houseId: scopedHouseId, ...scope },
      data: expenseFields(catalogItemToExpense(saved)),
    });
  } else if (isIncomeKind(prev)) {
    const existing = await prisma.income.findFirst({
      where: { id, houseId: scopedHouseId, ...scope },
      select: { position: true, sourceItemId: true },
    });
    if (existing) {
      await prisma.$transaction([
        prisma.income.deleteMany({ where: { id, houseId: scopedHouseId, ...scope } }),
        prisma.expense.create({
          data: {
            id,
            houseId: scopedHouseId,
            snapshotId: scopedSnapshotId,
            sourceItemId: existing.sourceItemId,
            position: existing.position,
            ...expenseFields(catalogItemToExpense(saved)),
          },
        }),
        prisma.planOverride.updateMany({
          where: { originalItemId: id, monthPlan: { houseId: scopedHouseId } },
          data: { type: 'expense' },
        }),
      ]);
    }
  } else {
    const existing = await prisma.expense.findFirst({
      where: { id, houseId: scopedHouseId, ...scope },
      select: { position: true, sourceItemId: true },
    });
    if (existing) {
      await prisma.$transaction([
        prisma.expense.deleteMany({ where: { id, houseId: scopedHouseId, ...scope } }),
        prisma.income.create({
          data: {
            id,
            houseId: scopedHouseId,
            snapshotId: scopedSnapshotId,
            sourceItemId: existing.sourceItemId,
            position: existing.position,
            ...incomeFields(catalogItemToIncome(saved)),
          },
        }),
        prisma.planOverride.updateMany({
          where: { originalItemId: id, monthPlan: { houseId: scopedHouseId } },
          data: { type: 'income' },
        }),
      ]);
    }
  }

  revalidatePath('/');
}

export async function deleteCatalogItem(
  houseId: string,
  itemId: string,
  snapshotId?: string | null
): Promise<void> {
  const { houseId: scopedHouseId } = await requireHouseAccess(houseId);
  const id = v.id(itemId, 'itemId');
  const scopedSnapshotId = await requireCatalogSnapshot(scopedHouseId, snapshotId);
  const scope = snapshotFilter(scopedSnapshotId);

  await prisma.$transaction([
    prisma.income.deleteMany({ where: { id, houseId: scopedHouseId, ...scope } }),
    prisma.expense.deleteMany({ where: { id, houseId: scopedHouseId, ...scope } }),
  ]);

  revalidatePath('/');
}

export async function reorderCatalogItems(
  houseId: string,
  orderedItemIds: string[],
  snapshotId?: string | null
): Promise<void> {
  const { houseId: scopedHouseId } = await requireHouseAccess(houseId);
  const scopedSnapshotId = await requireCatalogSnapshot(scopedHouseId, snapshotId);
  const scope = snapshotFilter(scopedSnapshotId);
  const seen = new Set<string>();
  const ids: string[] = [];

  for (const rawId of orderedItemIds) {
    const itemId = v.id(rawId, 'itemId');
    if (seen.has(itemId)) continue;
    seen.add(itemId);
    ids.push(itemId);
  }

  await prisma.$transaction(
    ids.flatMap((itemId, position) => [
      prisma.income.updateMany({
        where: { id: itemId, houseId: scopedHouseId, ...scope },
        data: { position },
      }),
      prisma.expense.updateMany({
        where: { id: itemId, houseId: scopedHouseId, ...scope },
        data: { position },
      }),
    ])
  );

  revalidatePath('/');
}
