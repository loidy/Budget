'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { errorText, fail } from '../i18n/fail';
import { auth } from '../lib/auth';
import { requireUser } from '../lib/auth-guard';
import { isInvitePlaceholderEmail } from '../lib/invites';
import { prisma } from '../lib/prisma';
import * as v from '../lib/validation';

async function parsePassword(value: unknown): Promise<string> {
  try {
    return v.password(value);
  } catch {
    return await fail('passwordMinLength');
  }
}

async function passwordErrorMessage(error: unknown): Promise<string> {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'object' && error && 'message' in error
        ? String((error as { message: unknown }).message)
        : '';

  if (/invalid password|INVALID_PASSWORD/i.test(message)) {
    return await errorText('wrongCurrentPassword');
  }

  return message || (await errorText('passwordChangeFailed'));
}

export async function getCredentialStatus(): Promise<{ hasPassword: boolean }> {
  const user = await requireUser();
  const ctx = await auth.$context;
  const account = await ctx.internalAdapter.findCredentialAccount(user.id);
  return { hasPassword: Boolean(account?.password) };
}

export async function updateOwnProfile(input: {
  name: string;
  currentPassword?: string;
  newPassword?: string;
}): Promise<void> {
  const user = await requireUser();
  const name = v.text(input.name, 'name');
  const newPassword = input.newPassword?.trim() ?? '';
  const nameChanged = name !== user.name;

  if (!nameChanged && !newPassword) {
    return await fail('noChanges');
  }

  if (nameChanged) {
    await auth.api.updateUser({
      body: { name },
      headers: await headers(),
    });
  }

  if (newPassword) {
    const parsedNew = await parsePassword(newPassword);
    const ctx = await auth.$context;
    const account = await ctx.internalAdapter.findCredentialAccount(user.id);

    if (account?.password) {
      try {
        await auth.api.changePassword({
          body: {
            currentPassword: input.currentPassword ?? '',
            newPassword: parsedNew,
          },
          headers: await headers(),
        });
      } catch (error) {
        throw new Error(await passwordErrorMessage(error));
      }
    } else {
      const hash = await ctx.password.hash(parsedNew);
      if (account) {
        await ctx.internalAdapter.updateAccount(account.id, { password: hash });
      } else {
        await ctx.internalAdapter.createAccount({
          userId: user.id,
          providerId: 'credential',
          accountId: user.id,
          password: hash,
        });
      }
    }
  }

  revalidatePath('/');
}

/** Invited users finish setup: real email, name, and a password they choose. */
export async function completeInvitedAccount(input: {
  name: string;
  email: string;
  password: string;
}): Promise<void> {
  const user = await requireUser();

  if (!isInvitePlaceholderEmail(user.email)) {
    return await fail('accountAlreadySetUp');
  }

  const name = v.text(input.name, 'name');
  let email: string;
  try {
    email = v.email(input.email);
  } catch {
    return await fail('invalidEmail');
  }
  const password = await parsePassword(input.password);

  if (isInvitePlaceholderEmail(email)) {
    return await fail('realEmailRequired');
  }

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existing && existing.id !== user.id) {
    return await fail('emailTaken');
  }

  const ctx = await auth.$context;
  const hash = await ctx.password.hash(password);
  const account = await ctx.internalAdapter.findCredentialAccount(user.id);

  if (account) {
    await ctx.internalAdapter.updateAccount(account.id, { password: hash });
  } else {
    await ctx.internalAdapter.createAccount({
      userId: user.id,
      providerId: 'credential',
      accountId: user.id,
      password: hash,
    });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { name, email, emailVerified: false },
  });

  revalidatePath('/');
}
