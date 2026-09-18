/**
 * Server actions are a public HTTP surface, so every value coming from the
 * client is re-checked here before it reaches the database.
 */

import { HOUSE_ICON_IDS, type HouseIconId } from './houseIcons';

const MAX_NAME = 200;
const MAX_NOTES = 2000;

export class ValidationError extends Error {}

export function text(value: unknown, field: string, maxLength = MAX_NAME): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ValidationError(`"${field}" must be a non-empty string.`);
  }

  return value.trim().slice(0, maxLength);
}

export function optionalText(value: unknown, maxLength = MAX_NOTES): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') {
    throw new ValidationError('Expected a string value.');
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed.slice(0, maxLength);
}

export function id(value: unknown, field: string): string {
  return text(value, field, 100);
}

export function optionalId(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  return id(value, 'id');
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function email(value: unknown): string {
  const parsed = text(value, 'email', 320).toLowerCase();
  if (!EMAIL_PATTERN.test(parsed)) {
    throw new ValidationError('Enter a valid email address.');
  }

  return parsed;
}

export function password(value: unknown): string {
  if (typeof value !== 'string' || value.length < 8) {
    throw new ValidationError('Password must be at least 8 characters.');
  }

  return value.slice(0, 128);
}

export function amount(value: unknown): number {
  const parsed = typeof value === 'string' ? Number(value) : value;

  if (typeof parsed !== 'number' || !Number.isFinite(parsed)) {
    throw new ValidationError('Amount must be a finite number.');
  }

  // Matches the Decimal(14, 2) column.
  return Math.round(parsed * 100) / 100;
}

export function day(value: unknown): number {
  const parsed = Math.trunc(Number(value));

  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 31) {
    throw new ValidationError('Day must be between 1 and 31.');
  }

  return parsed;
}

export function monthNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;

  const parsed = Math.trunc(Number(value));
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 12) {
    throw new ValidationError('Month must be between 1 and 12.');
  }

  return parsed;
}

export function monthKey(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
    throw new ValidationError('Month key must look like "2026-09".');
  }

  return value;
}

export function boolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

export function visibilityLevel(value: unknown): 0 | 1 | 2 {
  const parsed = Math.trunc(Number(value));
  if (parsed === 0 || parsed === 1 || parsed === 2) return parsed;
  throw new ValidationError('Visibility must be 0, 1, or 2.');
}

export function enumValue<T extends string>(
  value: unknown,
  allowed: readonly T[],
  field: string
): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new ValidationError(`"${field}" must be one of: ${allowed.join(', ')}.`);
  }

  return value as T;
}

export function houseIcon(value: unknown): HouseIconId {
  return enumValue(value, HOUSE_ICON_IDS, 'icon');
}

export function idList(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) {
    throw new ValidationError(`"${field}" must be an array.`);
  }

  return value.map((item, index) => id(item, `${field}[${index}]`));
}
