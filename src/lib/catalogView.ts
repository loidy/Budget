import {
  CATALOG_KINDS,
  CATALOG_SORT_KEYS,
  type CatalogRow,
  type CatalogSortDir,
  type CatalogSortKey,
  type CatalogViewState,
  type House,
} from '../types';
import { visibleAccounts } from '../utils/budgetLogic';

export const UNLABELED_ID = '__unlabeled__';

export const APP_TABS = ['cashflow', 'budget_plan', 'catalog', 'tables', 'manage'] as const;
export type AppTabId = (typeof APP_TABS)[number];

export type { CatalogSortDir, CatalogSortKey, CatalogViewState };

export function catalogKindOptionIds(): string[] {
  return [...CATALOG_KINDS];
}

export function catalogAccountOptionIds(house: House): string[] {
  return house.accounts.map((account) => account.id);
}

export function catalogLabelOptionIds(house: House): string[] {
  return [...house.labels.map((label) => label.id), UNLABELED_ID];
}

export function defaultCatalogViewState(house: House): CatalogViewState {
  return {
    kindIds: catalogKindOptionIds(),
    accountIds: visibleAccounts(house.accounts).map((account) => account.id),
    labelIds: catalogLabelOptionIds(house),
    sortKey: 'date',
    sortDir: 'asc',
  };
}

export function isCatalogSortKey(value: unknown): value is CatalogSortKey {
  return typeof value === 'string' && (CATALOG_SORT_KEYS as readonly string[]).includes(value);
}

export function isCatalogSortDir(value: unknown): value is CatalogSortDir {
  return value === 'asc' || value === 'desc';
}

export function isAppTabId(value: unknown): value is AppTabId {
  return typeof value === 'string' && (APP_TABS as readonly string[]).includes(value);
}

function orderSelected(allIds: string[], selected: string[]): string[] {
  const selectedSet = new Set(selected);
  return allIds.filter((id) => selectedSet.has(id));
}

function sameIdSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const other = new Set(b);
  return a.every((id) => other.has(id));
}

export function sanitizeCatalogViewState(
  state: Partial<CatalogViewState> | undefined,
  house: House
): CatalogViewState {
  const defaults = defaultCatalogViewState(house);
  const kindIds = orderSelected(catalogKindOptionIds(), state?.kindIds ?? defaults.kindIds);
  const accountIds = orderSelected(catalogAccountOptionIds(house), state?.accountIds ?? defaults.accountIds);
  const labelIds = orderSelected(catalogLabelOptionIds(house), state?.labelIds ?? defaults.labelIds);

  return {
    kindIds,
    accountIds,
    labelIds,
    sortKey: isCatalogSortKey(state?.sortKey) ? state.sortKey : defaults.sortKey,
    sortDir: isCatalogSortDir(state?.sortDir) ? state.sortDir : defaults.sortDir,
  };
}

export function filterCatalogByAccountAndLabel(
  rows: CatalogRow[],
  state: CatalogViewState,
  knownLabelIds: Set<string>
): CatalogRow[] {
  return rows.filter((item) => {
    if (!state.accountIds.includes(item.accountId)) return false;
    const labelFilterId =
      item.labelId && knownLabelIds.has(item.labelId) ? item.labelId : UNLABELED_ID;
    return state.labelIds.includes(labelFilterId);
  });
}

export function applyCatalogView(
  rows: CatalogRow[],
  state: CatalogViewState,
  knownLabelIds: Set<string>
): CatalogRow[] {
  return filterCatalogByAccountAndLabel(rows, state, knownLabelIds).filter((item) =>
    state.kindIds.includes(item.kind)
  );
}

export function toggleCatalogSort(state: CatalogViewState, key: CatalogSortKey): CatalogViewState {
  if (state.sortKey === key) {
    return { ...state, sortDir: state.sortDir === 'asc' ? 'desc' : 'asc' };
  }
  return { ...state, sortKey: key, sortDir: 'asc' };
}

function readListParam(params: URLSearchParams, key: string): string[] | undefined {
  if (!params.has(key)) return undefined;
  const raw = params.get(key);
  if (raw === null || raw === '') return [];
  return raw.split(',').map((part) => part.trim()).filter((part) => part.length > 0);
}

function writeListParam(
  params: URLSearchParams,
  key: string,
  selected: string[],
  defaults: string[]
) {
  if (sameIdSet(selected, defaults)) {
    params.delete(key);
    return;
  }
  params.set(key, selected.join(','));
}

export function parseCatalogViewSearchParams(
  params: URLSearchParams,
  house: House
): CatalogViewState {
  const defaults = defaultCatalogViewState(house);
  const kinds = readListParam(params, 'kinds');
  const accounts = readListParam(params, 'accounts');
  const labels = readListParam(params, 'labels');
  const sortRaw = params.get('sort');
  const dirRaw = params.get('dir');

  return sanitizeCatalogViewState(
    {
      kindIds: kinds === undefined ? defaults.kindIds : kinds,
      accountIds: accounts === undefined ? defaults.accountIds : accounts,
      labelIds: labels === undefined ? defaults.labelIds : labels,
      sortKey: isCatalogSortKey(sortRaw) ? sortRaw : defaults.sortKey,
      sortDir: isCatalogSortDir(dirRaw) ? dirRaw : defaults.sortDir,
    },
    house
  );
}

export function writeCatalogViewSearchParams(
  params: URLSearchParams,
  state: CatalogViewState,
  house: House
): void {
  const normalized = sanitizeCatalogViewState(state, house);
  const defaults = defaultCatalogViewState(house);

  writeListParam(params, 'kinds', normalized.kindIds, defaults.kindIds);
  writeListParam(params, 'accounts', normalized.accountIds, defaults.accountIds);
  writeListParam(params, 'labels', normalized.labelIds, defaults.labelIds);

  if (normalized.sortKey === 'date') params.delete('sort');
  else params.set('sort', normalized.sortKey);

  if (normalized.sortDir === 'asc') params.delete('dir');
  else params.set('dir', normalized.sortDir);
}

export function parseAppSearchParams(
  params: URLSearchParams,
  houses: House[]
): { houseId: string; tab: AppTabId; catalogView: CatalogViewState } {
  const fallbackHouse = houses[0];
  if (!fallbackHouse) {
    return {
      houseId: '',
      tab: 'cashflow',
      catalogView: {
        kindIds: [...CATALOG_KINDS],
        accountIds: [],
        labelIds: [UNLABELED_ID],
        sortKey: 'date',
        sortDir: 'asc',
      },
    };
  }

  const requestedHouseId = params.get('h');
  const house =
    requestedHouseId && houses.some((item) => item.id === requestedHouseId)
      ? houses.find((item) => item.id === requestedHouseId) ?? fallbackHouse
      : fallbackHouse;
  const tabRaw = params.get('tab');

  return {
    houseId: house.id,
    tab: isAppTabId(tabRaw) ? tabRaw : 'cashflow',
    catalogView: parseCatalogViewSearchParams(params, house),
  };
}

export function buildAppSearchParams(input: {
  houseId: string;
  tab: AppTabId;
  catalogView: CatalogViewState;
  houses: House[];
}): URLSearchParams {
  const params = new URLSearchParams();
  const defaultHouseId = input.houses[0]?.id;
  const house =
    input.houses.find((item) => item.id === input.houseId) ?? input.houses[0];
  if (!house) return params;

  if (input.houseId && input.houseId !== defaultHouseId) {
    params.set('h', input.houseId);
  }
  if (input.tab !== 'cashflow') {
    params.set('tab', input.tab);
  }
  writeCatalogViewSearchParams(params, input.catalogView, house);
  return params;
}

export function writeShallowUrl(params: URLSearchParams, mode: 'push' | 'replace'): void {
  if (typeof window === 'undefined') return;
  const query = params.toString();
  const href = `${window.location.pathname}${query ? `?${query}` : ''}`;
  const current = `${window.location.pathname}${window.location.search}`;
  if (href === current) return;

  if (mode === 'push') {
    window.history.pushState(window.history.state, '', href);
  } else {
    window.history.replaceState(window.history.state, '', href);
  }
}

export function searchParamsFromRecord(
  record: Record<string, string | string[] | undefined>
): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(record)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      params.set(key, value[value.length - 1] ?? '');
    } else {
      params.set(key, value);
    }
  }
  return params;
}

export function catalogViewFromRecord(view: {
  kindIds: string[];
  accountIds: string[];
  labelIds: string[];
  sortKey: string;
  sortDir: string;
}): CatalogViewState {
  return {
    kindIds: [...view.kindIds],
    accountIds: [...view.accountIds],
    labelIds: [...view.labelIds],
    sortKey: isCatalogSortKey(view.sortKey) ? view.sortKey : 'date',
    sortDir: isCatalogSortDir(view.sortDir) ? view.sortDir : 'asc',
  };
}
