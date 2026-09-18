import { headers } from 'next/headers';
import type { SessionUser } from '../types';
import { errorText } from '../i18n/fail';
import { auth } from './auth';
import { prisma } from './prisma';
import { id as parseId } from './validation';

export class AuthError extends Error {}

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;

  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    image: session.user.image,
  };
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    throw new AuthError(await errorText('mustSignIn'));
  }

  return user;
}

export async function requireHouseAccess(houseId: string): Promise<{
  user: SessionUser;
  houseId: string;
  isOwner: boolean;
}> {
  const user = await requireUser();
  const scopedHouseId = parseId(houseId, 'houseId');

  const house = await prisma.house.findFirst({
    where: {
      id: scopedHouseId,
      OR: [{ ownerId: user.id }, { members: { some: { userId: user.id } } }],
    },
    select: { id: true, ownerId: true },
  });

  if (!house) {
    throw new AuthError(await errorText('noHouseAccess'));
  }

  return { user, houseId: house.id, isOwner: house.ownerId === user.id };
}

export async function requireHouseOwner(houseId: string): Promise<{
  user: SessionUser;
  houseId: string;
}> {
  const access = await requireHouseAccess(houseId);
  if (!access.isOwner) {
    throw new AuthError(await errorText('ownerOnly'));
  }

  return { user: access.user, houseId: access.houseId };
}
