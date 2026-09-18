'use server';

import { revalidatePath } from 'next/cache';
import { errorText } from '../i18n/fail';
import { requireHouseAccess } from '../lib/auth-guard';
import { prisma } from '../lib/prisma';
import type { BankAccount, ItemLabel } from '../types';
import * as v from '../lib/validation';

function accountFields(account: BankAccount) {
  return {
    name: v.text(account.name, 'name'),
    color: v.text(account.color, 'color', 32),
    visibility: v.visibilityLevel(account.visibility),
  };
}

async function requireHouseAccount(houseId: string, accountId: string): Promise<string> {
  const scopedAccountId = v.id(accountId, 'accountId');
  const account = await prisma.bankAccount.findFirst({
    where: { id: scopedAccountId, houseId },
    select: { id: true },
  });

  if (!account) {
    throw new v.ValidationError(await errorText('accountNotInHouse'));
  }

  return scopedAccountId;
}

export async function createAccount(houseId: string, account: BankAccount): Promise<void> {
  const { houseId: scopedHouseId } = await requireHouseAccess(houseId);
  const { _max } = await prisma.bankAccount.aggregate({
    where: { houseId: scopedHouseId },
    _max: { position: true },
  });

  await prisma.bankAccount.create({
    data: {
      id: v.id(account.id, 'id'),
      houseId: scopedHouseId,
      position: (_max.position ?? -1) + 1,
      ...accountFields(account),
    },
  });

  revalidatePath('/');
}

export async function updateAccount(houseId: string, account: BankAccount): Promise<void> {
  const { houseId: scopedHouseId } = await requireHouseAccess(houseId);
  await prisma.bankAccount.updateMany({
    where: { id: v.id(account.id, 'id'), houseId: scopedHouseId },
    data: accountFields(account),
  });

  revalidatePath('/');
}

/**
 * Deleting an account moves items onto the first remaining account. Labels
 * belong to the account, so they are removed with it.
 */
export async function deleteAccount(houseId: string, accountId: string): Promise<void> {
  const { houseId: scopedHouseId } = await requireHouseAccess(houseId);
  const scopedAccountId = v.id(accountId, 'accountId');

  const fallback = await prisma.bankAccount.findFirst({
    where: { houseId: scopedHouseId, id: { not: scopedAccountId } },
    orderBy: [{ position: 'asc' }, { name: 'asc' }],
    select: { id: true },
  });

  await prisma.$transaction([
    prisma.income.updateMany({
      where: { houseId: scopedHouseId, accountId: scopedAccountId },
      data: { accountId: fallback?.id ?? null },
    }),
    prisma.expense.updateMany({
      where: { houseId: scopedHouseId, accountId: scopedAccountId },
      data: { accountId: fallback?.id ?? null },
    }),
    prisma.planOverride.updateMany({
      where: { accountId: scopedAccountId, monthPlan: { houseId: scopedHouseId } },
      data: { accountId: fallback?.id ?? null },
    }),
    prisma.customItem.updateMany({
      where: { accountId: scopedAccountId, monthPlan: { houseId: scopedHouseId } },
      data: { accountId: fallback?.id ?? null },
    }),
    prisma.bankAccount.deleteMany({
      where: { id: scopedAccountId, houseId: scopedHouseId },
    }),
  ]);

  revalidatePath('/');
}

export async function createLabel(houseId: string, label: ItemLabel): Promise<void> {
  const { houseId: scopedHouseId } = await requireHouseAccess(houseId);
  const accountId = await requireHouseAccount(scopedHouseId, label.accountId);
  const { _max } = await prisma.label.aggregate({
    where: { houseId: scopedHouseId },
    _max: { position: true },
  });

  await prisma.label.create({
    data: {
      id: v.id(label.id, 'id'),
      houseId: scopedHouseId,
      name: v.text(label.name, 'name'),
      color: v.text(label.color, 'color', 32),
      accountId,
      position: (_max.position ?? -1) + 1,
    },
  });

  revalidatePath('/');
}

export async function updateLabel(houseId: string, label: ItemLabel): Promise<void> {
  const { houseId: scopedHouseId } = await requireHouseAccess(houseId);
  const accountId = await requireHouseAccount(scopedHouseId, label.accountId);

  await prisma.label.updateMany({
    where: { id: v.id(label.id, 'id'), houseId: scopedHouseId },
    data: {
      name: v.text(label.name, 'name'),
      color: v.text(label.color, 'color', 32),
      accountId,
    },
  });

  revalidatePath('/');
}

/** Items keep their own account; the schema nulls their `labelId` on delete. */
export async function deleteLabel(houseId: string, labelId: string): Promise<void> {
  const { houseId: scopedHouseId } = await requireHouseAccess(houseId);
  await prisma.label.deleteMany({
    where: { id: v.id(labelId, 'labelId'), houseId: scopedHouseId },
  });

  revalidatePath('/');
}
