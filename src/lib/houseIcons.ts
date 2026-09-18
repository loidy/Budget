export const HOUSE_ICON_IDS = [
  'home',
  'building',
  'briefcase',
  'landmark',
  'warehouse',
  'store',
  'factory',
  'castle',
  'trees',
  'car',
  'heart',
  'wallet',
  'piggyBank',
  'globe',
  'laptop',
  'users',
] as const;

export type HouseIconId = (typeof HOUSE_ICON_IDS)[number];

export const DEFAULT_HOUSE_ICON: HouseIconId = 'home';

export function isHouseIconId(value: unknown): value is HouseIconId {
  return typeof value === 'string' && (HOUSE_ICON_IDS as readonly string[]).includes(value);
}
