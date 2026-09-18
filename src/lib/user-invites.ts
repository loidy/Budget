import { isInviteToken } from './invites';
import { prisma } from './prisma';

export type OpenUserInvite = {
  name: string;
  email: string;
};

export async function getOpenUserInvite(token: string): Promise<OpenUserInvite | null> {
  if (!isInviteToken(token)) return null;

  return prisma.userInvite.findFirst({
    where: { token, consumedAt: null },
    select: { name: true, email: true },
  });
}
