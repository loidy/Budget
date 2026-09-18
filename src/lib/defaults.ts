import type { BankAccount, ItemLabel } from '../types';

/**
 * Shared by the optimistic client update and the server action so a newly
 * created house looks identical before and after it hits the database.
 */
export const NEW_HOUSE_ACCOUNT: Omit<BankAccount, 'id'> = {
  name: 'Main checking account',
  color: '#2563eb',
  visibility: 0,
};

export const NEW_HOUSE_LABEL: Omit<ItemLabel, 'id' | 'accountId'> = {
  name: 'Operating costs',
  color: '#8b5cf6',
};
