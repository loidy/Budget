/** Stored sentinel for invited users who have not finished account setup. */
export const INVITE_PLACEHOLDER_NAME = 'Nový používateľ';

/** Placeholder emails for users created by opening a house invite link. */
const INVITE_EMAIL_PATTERN = /^invite-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}@example\.com$/i;

export function isInvitePlaceholderEmail(email: string): boolean {
  return INVITE_EMAIL_PATTERN.test(email);
}

export function newInvitePlaceholderEmail(): string {
  return `invite-${crypto.randomUUID()}@example.com`;
}

export function newInviteToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function isInviteToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{20,}$/.test(token);
}
