'use server';

import { requireHouseOwner, requireUser } from '../lib/auth-guard';
import { fail } from '../i18n/fail';
import { newId } from '../lib/ids';
import { isInvitePlaceholderEmail, newInviteToken } from '../lib/invites';
import { prisma } from '../lib/prisma';
import * as v from '../lib/validation';

const invitePlaceholderEmail = {
  startsWith: 'invite-',
  endsWith: '@example.com',
};

export type ListedUser = {
  id: string;
  name: string;
  email: string;
};

export type PendingUserInvite = {
  id: string;
  name: string;
  email: string;
  token: string;
};

export async function listUsers(): Promise<ListedUser[]> {
  await requireUser();

  const users = await prisma.user.findMany({
    where: {
      NOT: {
        AND: [
          { email: { startsWith: invitePlaceholderEmail.startsWith } },
          { email: { endsWith: invitePlaceholderEmail.endsWith } },
        ],
      },
    },
    select: { id: true, name: true, email: true },
    orderBy: [{ name: 'asc' }, { email: 'asc' }],
  });

  return users;
}

export async function searchSharableUsers(houseId: string, query: string): Promise<ListedUser[]> {
  const { user, houseId: scopedHouseId } = await requireHouseOwner(houseId);
  const needle = query.trim();
  if (needle.length < 2) return [];

  const house = await prisma.house.findUnique({
    where: { id: scopedHouseId },
    select: { ownerId: true, members: { select: { userId: true } } },
  });

  if (!house) return [];

  const excludedIds = [house.ownerId, user.id, ...house.members.map((member) => member.userId)];

  return prisma.user.findMany({
    where: {
      id: { notIn: excludedIds },
      NOT: {
        AND: [
          { email: { startsWith: invitePlaceholderEmail.startsWith } },
          { email: { endsWith: invitePlaceholderEmail.endsWith } },
        ],
      },
      OR: [
        { name: { contains: needle, mode: 'insensitive' } },
        { email: { contains: needle, mode: 'insensitive' } },
      ],
    },
    select: { id: true, name: true, email: true },
    take: 8,
    orderBy: [{ name: 'asc' }, { email: 'asc' }],
  });
}

export async function listPendingUserInvites(): Promise<PendingUserInvite[]> {
  const user = await requireUser();

  return prisma.userInvite.findMany({
    where: { createdById: user.id, consumedAt: null },
    select: { id: true, name: true, email: true, token: true },
    orderBy: { createdAt: 'desc' },
  });
}

/** Creates an account-only invite. Does not grant access to any house. */
export async function createUserInvite(input: {
  name: string;
  email: string;
}): Promise<PendingUserInvite> {
  const user = await requireUser();
  const name = v.text(input.name, 'name');

  let email: string;
  try {
    email = v.email(input.email);
  } catch {
    return await fail('invalidEmail');
  }

  if (isInvitePlaceholderEmail(email)) {
    return await fail('realEmailRequired');
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existingUser) {
    return await fail('emailTaken');
  }

  const pending = await prisma.userInvite.findFirst({
    where: { email, consumedAt: null },
    select: { id: true, createdById: true },
  });

  const token = newInviteToken();

  if (pending) {
    if (pending.createdById !== user.id) {
      return await fail('pendingInviteExists');
    }

    return prisma.userInvite.update({
      where: { id: pending.id },
      data: { name, token },
      select: { id: true, name: true, email: true, token: true },
    });
  }

  return prisma.userInvite.create({
    data: {
      id: newId('uinvite'),
      token,
      name,
      email,
      createdById: user.id,
    },
    select: { id: true, name: true, email: true, token: true },
  });
}
