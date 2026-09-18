'use server';

import { revalidatePath } from 'next/cache';
import { NEW_HOUSE_ACCOUNT, NEW_HOUSE_LABEL } from '../lib/defaults';
import { fail } from '../i18n/fail';
import { requireHouseAccess, requireHouseOwner, requireUser } from '../lib/auth-guard';
import { newId } from '../lib/ids';
import { newInviteToken } from '../lib/invites';
import { prisma } from '../lib/prisma';
import * as v from '../lib/validation';

export interface NewHouseInput {
  id: string;
  name: string;
  description: string;
  icon: string;
  defaultAccountId: string;
  defaultLabelId: string;
  defaultAccountName?: string;
  defaultLabelName?: string;
}

/** A new house is never empty: it starts with one account and one label. */
export async function createHouse(input: NewHouseInput): Promise<void> {
  const user = await requireUser();
  const houseId = v.id(input.id, 'id');
  const defaultAccountId = v.id(input.defaultAccountId, 'defaultAccountId');
  const { _max } = await prisma.house.aggregate({ _max: { position: true } });

  await prisma.house.create({
    data: {
      id: houseId,
      name: v.text(input.name, 'name'),
      description: v.optionalText(input.description),
      icon: v.houseIcon(input.icon),
      position: (_max.position ?? -1) + 1,
      ownerId: user.id,
      accounts: {
        create: {
          id: defaultAccountId,
          ...NEW_HOUSE_ACCOUNT,
          name: v.text(input.defaultAccountName ?? NEW_HOUSE_ACCOUNT.name, 'defaultAccountName'),
        },
      },
      labels: {
        create: {
          id: v.id(input.defaultLabelId, 'defaultLabelId'),
          name: v.text(input.defaultLabelName ?? NEW_HOUSE_LABEL.name, 'defaultLabelName'),
          color: NEW_HOUSE_LABEL.color,
          accountId: defaultAccountId,
        },
      },
    },
  });

  revalidatePath('/');
}

export async function updateHouse(
  houseId: string,
  input: { name: string; description: string; icon: string }
): Promise<void> {
  const { houseId: scopedHouseId } = await requireHouseAccess(houseId);

  await prisma.house.update({
    where: { id: scopedHouseId },
    data: {
      name: v.text(input.name, 'name'),
      description: v.optionalText(input.description),
      icon: v.houseIcon(input.icon),
    },
  });

  revalidatePath('/');
}

export async function deleteHouse(houseId: string): Promise<void> {
  const { houseId: scopedHouseId } = await requireHouseOwner(houseId);

  await prisma.house.delete({ where: { id: scopedHouseId } });

  revalidatePath('/');
}

export async function shareHouse(houseId: string, email: string): Promise<void> {
  const { user, houseId: scopedHouseId } = await requireHouseOwner(houseId);
  const memberEmail = v.email(email);

  const member = await prisma.user.findUnique({
    where: { email: memberEmail },
    select: { id: true },
  });

  if (!member) {
    return await fail('userNotFound');
  }

  if (member.id === user.id) {
    return await fail('ownerAlreadyHasAccess');
  }

  await prisma.houseMember.upsert({
    where: { houseId_userId: { houseId: scopedHouseId, userId: member.id } },
    create: { id: newId('member'), houseId: scopedHouseId, userId: member.id },
    update: {},
  });

  revalidatePath('/');
}

export async function unshareHouse(houseId: string, userId: string): Promise<void> {
  const { houseId: scopedHouseId } = await requireHouseOwner(houseId);

  await prisma.houseMember.deleteMany({
    where: { houseId: scopedHouseId, userId: v.id(userId, 'userId') },
  });

  revalidatePath('/');
}

export async function getOrCreateHouseInviteToken(houseId: string): Promise<string> {
  const { houseId: scopedHouseId } = await requireHouseOwner(houseId);

  const existing = await prisma.houseInvite.findUnique({
    where: { houseId: scopedHouseId },
    select: { token: true },
  });

  if (existing) return existing.token;

  const created = await prisma.houseInvite.create({
    data: {
      id: newId('invite'),
      token: newInviteToken(),
      houseId: scopedHouseId,
    },
    select: { token: true },
  });

  return created.token;
}
