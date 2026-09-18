/** 0 everywhere, 1 excluded from the dashboard, 2 excluded from all views. */
export const ACCOUNT_VISIBILITY = {
  everywhere: 0,
  exceptDashboard: 1,
  nowhere: 2,
} as const;
export type AccountVisibility = (typeof ACCOUNT_VISIBILITY)[keyof typeof ACCOUNT_VISIBILITY];

export interface BankAccount {
  id: string;
  name: string;
  color: string;
  visibility: AccountVisibility;
}

export interface ItemLabel {
  id: string;
  name: string;
  color: string;
  /** Every label belongs to an account; items with this label use that account. */
  accountId: string;
}

export type ExpenseFrequency = 'monthly' | 'annual';

export const CATALOG_KINDS = ['monthly_income', 'monthly_expense', 'annual_expense'] as const;
export type CatalogKind = (typeof CATALOG_KINDS)[number];

export const CATALOG_SORT_KEYS = ['name', 'date', 'amount', 'kind', 'label', 'account'] as const;
export type CatalogSortKey = (typeof CATALOG_SORT_KEYS)[number];
export type CatalogSortDir = 'asc' | 'desc';

export interface CatalogViewState {
  kindIds: string[];
  accountIds: string[];
  labelIds: string[];
  sortKey: CatalogSortKey;
  sortDir: CatalogSortDir;
}

export interface CatalogTableView {
  id: string;
  name: string;
  position: number;
  view: CatalogViewState;
}

/** A frozen copy of the catalog, valid for months up to and including `validUntil`. */
export interface CatalogSnapshot {
  id: string;
  validUntil: string; // "YYYY-MM", inclusive
  createdAt: string;
  incomes: IncomeItem[];
  expenses: ExpenseItem[];
}

export interface IncomeItem {
  id: string;
  name: string;
  amount: number;
  day: number; // 1 - 31
  labelId?: string | null;
  accountId?: string | null; // direct account if not tied via label
  notes?: string;
  isActive?: boolean;
  position?: number;
  /** Main-table id this snapshot row was copied from. Null on the live table. */
  sourceItemId?: string | null;
}

export interface ExpenseItem {
  id: string;
  name: string;
  amount: number; // can be negative for offsets/reimbursements
  day: number; // 1 - 31
  frequency: ExpenseFrequency;
  month?: number; // 1 - 12 (required if frequency === 'annual')
  labelId?: string | null;
  accountId?: string | null; // direct account if not tied via label
  notes?: string;
  isActive?: boolean;
  position?: number;
  /** Main-table id this snapshot row was copied from. Null on the live table. */
  sourceItemId?: string | null;
}

export interface CatalogItem {
  id: string;
  kind: CatalogKind;
  name: string;
  amount: number;
  day: number;
  month?: number;
  labelId?: string | null;
  accountId?: string | null;
  notes?: string;
  isActive?: boolean;
  position?: number;
}

export interface CatalogRow extends CatalogItem {
  accountId: string;
  accountName: string;
  accountColor: string;
  labelName?: string;
  labelColor?: string;
  isTiedViaLabel: boolean;
}

export interface BudgetItemOverride {
  id: string;
  originalItemId?: string; // set if overriding a synced income/expense
  isCustom: boolean; // true if added only for this specific month
  type: 'income' | 'expense';
  name: string;
  amount: number;
  day: number;
  accountId: string;
  labelId?: string | null;
  isPaid?: boolean;
  notes?: string;
}

export interface MonthBudgetPlan {
  monthKey: string; // e.g. "2026-09"
  overrides: Record<string, BudgetItemOverride>; // key is originalItemId
  customItems: BudgetItemOverride[];
  settledItemIds: Record<string, boolean>; // itemId -> true if settled/paid
  /** Per-month order of resolved item ids. Missing ids fall back after saved positions. */
  itemPositions: Record<string, number>;
  /** Explicit opening balances keyed by account id. Missing keys fall back to the previous month. */
  openingBalances: Record<string, number>;
}

export type HouseRole = 'owner' | 'member';

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  image?: string | null;
}

export interface HouseShareMember {
  userId: string;
  name: string;
  email: string;
}

export interface House {
  id: string;
  name: string;
  description?: string;
  icon: string;
  role: HouseRole;
  members: HouseShareMember[];
  accounts: BankAccount[];
  labels: ItemLabel[];
  incomes: IncomeItem[];
  expenses: ExpenseItem[];
  monthlyPlans: Record<string, MonthBudgetPlan>; // key: "YYYY-MM"
  catalogTableViews: CatalogTableView[];
  /** Historical catalog versions, ordered by validUntil ascending. */
  catalogSnapshots: CatalogSnapshot[];
}

export interface ResolvedBudgetItem {
  id: string;
  originalItemId?: string;
  sourceType: 'synced_income' | 'synced_monthly_expense' | 'synced_annual_expense' | 'custom_item' | 'opening_correction';
  type: 'income' | 'expense';
  name: string;
  amount: number;
  originalAmount?: number;
  day: number;
  originalDay?: number;
  accountId: string;
  accountName: string;
  accountColor: string;
  labelId?: string | null;
  labelName?: string;
  labelColor?: string;
  isTiedViaLabel: boolean;
  isOverridden: boolean;
  isCustom: boolean;
  isPaid: boolean;
  notes?: string;
}

export interface CashFlowPoint {
  monthKey: string;
  day: number;
  index: number;
  dateStr: string;
  balanceByAccount: Record<string, number>;
  flowByAccount: Record<string, number>;
  items: ResolvedBudgetItem[];
}
