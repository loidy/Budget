'use server';

import { revalidatePath } from 'next/cache';
import { requireHouseAccess } from '../lib/auth-guard';
import { newId } from '../lib/ids';
import { prisma } from '../lib/prisma';
import type { BudgetItemOverride } from '../types';
import * as v from '../lib/validation';

const ITEM_TYPES = ['income', 'expense'] as const;

/** A month plan row is only created once the month actually deviates from the catalog. */
async function ensureMonthPlan(houseId: string, monthKey: string): Promise<string> {
  const plan = await prisma.monthPlan.upsert({
    where: { houseId_monthKey: { houseId, monthKey } },
    create: { id: newId('plan'), houseId, monthKey },
    update: {},
    select: { id: true },
  });

  return plan.id;
}

function itemFields(item: BudgetItemOverride) {
  return {
    type: v.enumValue(item.type, ITEM_TYPES, 'type'),
    name: v.text(item.name, 'name'),
    amount: v.amount(item.amount),
    day: v.day(item.day),
    accountId: v.optionalId(item.accountId),
    labelId: v.optionalId(item.labelId),
    notes: v.optionalText(item.notes),
  };
}

export async function setOverride(
  houseId: string,
  monthKey: string,
  override: BudgetItemOverride
): Promise<void> {
  const { houseId: scopedHouseId } = await requireHouseAccess(houseId);
  const monthPlanId = await ensureMonthPlan(scopedHouseId, v.monthKey(monthKey));
  const originalItemId = v.id(override.originalItemId, 'originalItemId');
  const fields = itemFields(override);
  const isPaid = override.isPaid ?? null;

  await prisma.planOverride.upsert({
    where: { monthPlanId_originalItemId: { monthPlanId, originalItemId } },
    create: {
      id: v.id(override.id, 'id'),
      monthPlanId,
      originalItemId,
      isPaid,
      ...fields,
    },
    update: { isPaid, ...fields },
  });

  revalidatePath('/');
}

/** Drops the deviation so the item falls back to its master catalog values. */
export async function clearOverride(
  houseId: string,
  monthKey: string,
  originalItemId: string
): Promise<void> {
  const { houseId: scopedHouseId } = await requireHouseAccess(houseId);
  await prisma.planOverride.deleteMany({
    where: {
      originalItemId: v.id(originalItemId, 'originalItemId'),
      monthPlan: {
        houseId: scopedHouseId,
        monthKey: v.monthKey(monthKey),
      },
    },
  });

  revalidatePath('/');
}

export async function addCustomItem(
  houseId: string,
  monthKey: string,
  item: BudgetItemOverride
): Promise<void> {
  const { houseId: scopedHouseId } = await requireHouseAccess(houseId);
  const monthPlanId = await ensureMonthPlan(scopedHouseId, v.monthKey(monthKey));

  await prisma.customItem.create({
    data: {
      id: v.id(item.id, 'id'),
      monthPlanId,
      isPaid: v.boolean(item.isPaid, false),
      ...itemFields(item),
    },
  });

  revalidatePath('/');
}

export async function updateCustomItem(
  houseId: string,
  monthKey: string,
  item: BudgetItemOverride
): Promise<void> {
  const { houseId: scopedHouseId } = await requireHouseAccess(houseId);
  await prisma.customItem.updateMany({
    where: {
      id: v.id(item.id, 'id'),
      monthPlan: {
        houseId: scopedHouseId,
        monthKey: v.monthKey(monthKey),
      },
    },
    data: { isPaid: v.boolean(item.isPaid, false), ...itemFields(item) },
  });

  revalidatePath('/');
}

export async function deleteCustomItem(
  houseId: string,
  monthKey: string,
  customItemId: string
): Promise<void> {
  const { houseId: scopedHouseId } = await requireHouseAccess(houseId);
  await prisma.customItem.deleteMany({
    where: {
      id: v.id(customItemId, 'customItemId'),
      monthPlan: {
        houseId: scopedHouseId,
        monthKey: v.monthKey(monthKey),
      },
    },
  });

  revalidatePath('/');
}

/** Marks a catalog or custom item as paid within a single month. */
export async function toggleSettled(
  houseId: string,
  monthKey: string,
  itemId: string,
  settled: boolean
): Promise<void> {
  const { houseId: scopedHouseId } = await requireHouseAccess(houseId);
  const monthPlanId = await ensureMonthPlan(scopedHouseId, v.monthKey(monthKey));
  const scopedItemId = v.id(itemId, 'itemId');
  const isSettled = v.boolean(settled, false);

  await prisma.settledItem.upsert({
    where: { monthPlanId_itemId: { monthPlanId, itemId: scopedItemId } },
    create: { id: newId('settled'), monthPlanId, itemId: scopedItemId, settled: isSettled },
    update: { settled: isSettled },
  });

  revalidatePath('/');
}

/** Saves the canonical month-table order (day is still primary in the resolver). */
export async function reorderPlanItems(
  houseId: string,
  monthKey: string,
  orderedItemIds: string[]
): Promise<void> {
  const { houseId: scopedHouseId } = await requireHouseAccess(houseId);
  const monthPlanId = await ensureMonthPlan(scopedHouseId, v.monthKey(monthKey));

  const seen = new Set<string>();
  const rows: { id: string; monthPlanId: string; itemId: string; position: number }[] = [];
  for (const rawId of orderedItemIds) {
    const itemId = v.id(rawId, 'itemId');
    if (seen.has(itemId)) continue;
    seen.add(itemId);
    rows.push({
      id: newId('ord'),
      monthPlanId,
      itemId,
      position: rows.length,
    });
  }

  await prisma.$transaction([
    prisma.planItemOrder.deleteMany({ where: { monthPlanId } }),
    ...(rows.length > 0 ? [prisma.planItemOrder.createMany({ data: rows })] : []),
  ]);

  revalidatePath('/');
}

/** Stores an explicit opening balance, or `null` to fall back to the previous month. */
export async function setOpeningBalance(
  houseId: string,
  monthKey: string,
  accountId: string,
  amount: number | null
): Promise<void> {
  const { houseId: scopedHouseId } = await requireHouseAccess(houseId);
  const scopedMonthKey = v.monthKey(monthKey);
  const scopedAccountId = v.id(accountId, 'accountId');

  if (amount === null) {
    await prisma.openingBalance.deleteMany({
      where: {
        accountId: scopedAccountId,
        monthPlan: {
          houseId: scopedHouseId,
          monthKey: scopedMonthKey,
        },
      },
    });
    revalidatePath('/');
    return;
  }

  const monthPlanId = await ensureMonthPlan(scopedHouseId, scopedMonthKey);

  await prisma.openingBalance.upsert({
    where: { monthPlanId_accountId: { monthPlanId, accountId: scopedAccountId } },
    create: {
      id: newId('ob'),
      monthPlanId,
      accountId: scopedAccountId,
      amount: v.amount(amount),
    },
    update: { amount: v.amount(amount) },
  });

  revalidatePath('/');
}
