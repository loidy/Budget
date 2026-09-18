'use server';

import { revalidatePath } from 'next/cache';
import { errorText } from '../i18n/fail';
import { requireHouseAccess } from '../lib/auth-guard';
import { prisma } from '../lib/prisma';
import * as v from '../lib/validation';
import { buildCatalogIdMap } from '../utils/budgetLogic';

export interface CatalogLockCopy {
  sourceId: string;
  id: string;
}

type SnapshotRecord = {
  id: string;
  validUntil: string;
  incomes: Array<{ id: string; sourceItemId: string | null }>;
  expenses: Array<{ id: string; sourceItemId: string | null }>;
};

function snapshotItems(snapshot: SnapshotRecord) {
  return [...snapshot.incomes, ...snapshot.expenses];
}

async function loadSnapshots(houseId: string): Promise<SnapshotRecord[]> {
  return prisma.catalogSnapshot.findMany({
    where: { houseId },
    select: {
      id: true,
      validUntil: true,
      incomes: { select: { id: true, sourceItemId: true } },
      expenses: { select: { id: true, sourceItemId: true } },
    },
    orderBy: { validUntil: 'asc' },
  });
}

async function loadMainItems(houseId: string) {
  const [incomes, expenses] = await Promise.all([
    prisma.income.findMany({
      where: { houseId, snapshotId: null },
      select: { id: true, sourceItemId: true },
    }),
    prisma.expense.findMany({
      where: { houseId, snapshotId: null },
      select: { id: true, sourceItemId: true },
    }),
  ]);

  return [...incomes, ...expenses];
}

async function remapPlanReferences(
  db: {
    monthPlan: { findMany: typeof prisma.monthPlan.findMany };
    planOverride: { updateMany: typeof prisma.planOverride.updateMany };
    settledItem: { updateMany: typeof prisma.settledItem.updateMany };
    planItemOrder: { updateMany: typeof prisma.planItemOrder.updateMany };
  },
  houseId: string,
  range: { gt?: string; lte: string },
  idMap: Map<string, string>
): Promise<void> {
  if (idMap.size === 0) return;

  const plans = await db.monthPlan.findMany({
    where: {
      houseId,
      monthKey: {
        ...(range.gt ? { gt: range.gt } : {}),
        lte: range.lte,
      },
    },
    select: { id: true },
  });
  if (plans.length === 0) return;

  const planIds = plans.map((plan) => plan.id);

  for (const [fromId, toId] of idMap) {
    await db.planOverride.updateMany({
      where: { monthPlanId: { in: planIds }, originalItemId: fromId },
      data: { originalItemId: toId },
    });
    await db.settledItem.updateMany({
      where: { monthPlanId: { in: planIds }, itemId: fromId },
      data: { itemId: toId },
    });
    await db.planItemOrder.updateMany({
      where: { monthPlanId: { in: planIds }, itemId: fromId },
      data: { itemId: toId },
    });
  }
}

async function assertValidUntilFits(
  snapshots: SnapshotRecord[],
  snapshotId: string,
  validUntil: string
): Promise<SnapshotRecord> {
  const index = snapshots.findIndex((snapshot) => snapshot.id === snapshotId);
  const current = snapshots[index];
  if (!current) {
    throw new v.ValidationError(await errorText('snapshotNotInHouse'));
  }

  const previous = snapshots[index - 1];
  const next = snapshots[index + 1];
  if (previous && validUntil <= previous.validUntil) {
    throw new v.ValidationError(await errorText('validUntilAfterPrevious'));
  }
  if (next && validUntil >= next.validUntil) {
    throw new v.ValidationError(await errorText('validUntilBeforeNext'));
  }
  if (snapshots.some((snapshot) => snapshot.id !== snapshotId && snapshot.validUntil === validUntil)) {
    throw new v.ValidationError(await errorText('validUntilTaken'));
  }

  return current;
}

export async function lockCatalog(
  houseId: string,
  input: { id: string; validUntil: string; copies: CatalogLockCopy[] }
): Promise<void> {
  const { houseId: scopedHouseId } = await requireHouseAccess(houseId);
  const snapshotId = v.id(input.id, 'id');
  const validUntil = v.monthKey(input.validUntil);

  const copies = input.copies.map((copy) => ({
    sourceId: v.id(copy.sourceId, 'sourceId'),
    id: v.id(copy.id, 'id'),
  }));
  const copyIds = new Set<string>();
  for (const copy of copies) {
    if (copyIds.has(copy.id) || copy.id === copy.sourceId) {
      throw new v.ValidationError(await errorText('lockIdsUnique'));
    }
    copyIds.add(copy.id);
  }

  const snapshots = await loadSnapshots(scopedHouseId);
  const latest = snapshots[snapshots.length - 1];
  if (latest && validUntil <= latest.validUntil) {
    throw new v.ValidationError(await errorText('validUntilAfterLatest'));
  }

  const [mainIncomes, mainExpenses] = await Promise.all([
    prisma.income.findMany({ where: { houseId: scopedHouseId, snapshotId: null } }),
    prisma.expense.findMany({ where: { houseId: scopedHouseId, snapshotId: null } }),
  ]);

  const mainIds = new Set([...mainIncomes, ...mainExpenses].map((item) => item.id));
  const copySourceIds = new Set(copies.map((copy) => copy.sourceId));
  if (mainIds.size !== copySourceIds.size || [...mainIds].some((id) => !copySourceIds.has(id))) {
    throw new v.ValidationError(await errorText('lockMustCoverAll'));
  }

  const incomeById = new Map(mainIncomes.map((item) => [item.id, item]));
  const expenseById = new Map(mainExpenses.map((item) => [item.id, item]));
  const idMap = new Map(copies.map((copy) => [copy.sourceId, copy.id]));

  await prisma.$transaction(async (tx) => {
    await tx.catalogSnapshot.create({
      data: {
        id: snapshotId,
        houseId: scopedHouseId,
        validUntil,
      },
    });

    await tx.income.createMany({
      data: copies.flatMap((copy) => {
        const income = incomeById.get(copy.sourceId);
        if (!income) return [];
        return [
          {
            id: copy.id,
            houseId: scopedHouseId,
            snapshotId,
            sourceItemId: income.id,
            name: income.name,
            amount: income.amount,
            day: income.day,
            labelId: income.labelId,
            accountId: income.accountId,
            notes: income.notes,
            isActive: income.isActive,
            position: income.position,
          },
        ];
      }),
    });

    await tx.expense.createMany({
      data: copies.flatMap((copy) => {
        const expense = expenseById.get(copy.sourceId);
        if (!expense) return [];
        return [
          {
            id: copy.id,
            houseId: scopedHouseId,
            snapshotId,
            sourceItemId: expense.id,
            name: expense.name,
            amount: expense.amount,
            day: expense.day,
            frequency: expense.frequency,
            month: expense.month,
            labelId: expense.labelId,
            accountId: expense.accountId,
            notes: expense.notes,
            isActive: expense.isActive,
            position: expense.position,
          },
        ];
      }),
    });

    await remapPlanReferences(
      tx,
      scopedHouseId,
      { gt: latest?.validUntil, lte: validUntil },
      idMap
    );
  });

  revalidatePath('/');
}

export async function updateCatalogSnapshotValidUntil(
  houseId: string,
  snapshotId: string,
  validUntil: string
): Promise<void> {
  const { houseId: scopedHouseId } = await requireHouseAccess(houseId);
  const scopedSnapshotId = v.id(snapshotId, 'snapshotId');
  const nextValidUntil = v.monthKey(validUntil);

  const snapshots = await loadSnapshots(scopedHouseId);
  const current = await assertValidUntilFits(snapshots, scopedSnapshotId, nextValidUntil);
  if (current.validUntil === nextValidUntil) return;

  const index = snapshots.findIndex((snapshot) => snapshot.id === scopedSnapshotId);
  const nextSnapshot = snapshots[index + 1];
  const neighbourItems = nextSnapshot ? snapshotItems(nextSnapshot) : await loadMainItems(scopedHouseId);
  const currentItems = snapshotItems(current);

  if (nextValidUntil > current.validUntil) {
    await remapPlanReferences(
      prisma,
      scopedHouseId,
      { gt: current.validUntil, lte: nextValidUntil },
      buildCatalogIdMap(neighbourItems, currentItems)
    );
  } else {
    await remapPlanReferences(
      prisma,
      scopedHouseId,
      { gt: nextValidUntil, lte: current.validUntil },
      buildCatalogIdMap(currentItems, neighbourItems)
    );
  }

  await prisma.catalogSnapshot.updateMany({
    where: { id: scopedSnapshotId, houseId: scopedHouseId },
    data: { validUntil: nextValidUntil },
  });

  revalidatePath('/');
}

export async function deleteCatalogSnapshot(houseId: string, snapshotId: string): Promise<void> {
  const { houseId: scopedHouseId } = await requireHouseAccess(houseId);
  const scopedSnapshotId = v.id(snapshotId, 'snapshotId');

  const snapshots = await loadSnapshots(scopedHouseId);
  const index = snapshots.findIndex((snapshot) => snapshot.id === scopedSnapshotId);
  const current = snapshots[index];
  if (!current) {
    throw new v.ValidationError(await errorText('snapshotNotInHouse'));
  }

  const previous = snapshots[index - 1];
  const nextSnapshot = snapshots[index + 1];
  const neighbourItems = nextSnapshot ? snapshotItems(nextSnapshot) : await loadMainItems(scopedHouseId);

  await remapPlanReferences(
    prisma,
    scopedHouseId,
    { gt: previous?.validUntil, lte: current.validUntil },
    buildCatalogIdMap(snapshotItems(current), neighbourItems)
  );

  await prisma.catalogSnapshot.deleteMany({
    where: { id: scopedSnapshotId, houseId: scopedHouseId },
  });

  revalidatePath('/');
}
