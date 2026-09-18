import 'dotenv/config';
import { createAuth } from '../src/lib/auth';
import { prisma } from '../src/lib/prisma';

/**
 * Local-only sample data used to record docs/demo.gif. Does not touch houses
 * owned by anyone except the demo user.
 *
 *   docker compose exec web npx tsx scripts/seed-readme-demo.ts
 *   node scripts/record-readme-demo.mjs
 */
const DEMO_EMAIL = 'maya@example.com';
const DEMO_PASSWORD = 'demo-readme-2026';
const DEMO_NAME = 'Maya Chen';

const YEAR = new Date().getFullYear();
const JANUARY = `${YEAR}-01`;
const CURRENT_MONTH = `${YEAR}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

async function ensureDemoUser(): Promise<string> {
  const auth = createAuth({ withNextCookies: false });
  const ctx = await auth.$context;
  const existing = await ctx.internalAdapter.findUserByEmail(DEMO_EMAIL);

  if (existing?.user) {
    return existing.user.id;
  }

  const hash = await ctx.password.hash(DEMO_PASSWORD);
  const user = await ctx.internalAdapter.createUser(
    {
      email: DEMO_EMAIL,
      name: DEMO_NAME,
      emailVerified: true,
    },
    { method: 'admin' }
  );

  if (!user) {
    throw new Error('Failed to create the demo user.');
  }

  await ctx.internalAdapter.linkAccount({
    userId: user.id,
    providerId: 'credential',
    accountId: user.id,
    password: hash,
  });

  return user.id;
}

async function seedHome(ownerId: string, position: number) {
  const houseId = 'demo-house-home';
  const checking = 'demo-acc-checking';
  const savings = 'demo-acc-savings';
  const card = 'demo-acc-card';

  const housing = 'demo-lbl-housing';
  const groceries = 'demo-lbl-groceries';
  const subs = 'demo-lbl-subs';
  const transport = 'demo-lbl-transport';
  const income = 'demo-lbl-income';
  const utilities = 'demo-lbl-utilities';
  const health = 'demo-lbl-health';

  await prisma.house.create({
    data: {
      id: houseId,
      name: 'Oak Street Home',
      description: 'Household cash flow for rent, bills, and savings',
      icon: 'home',
      position,
      ownerId,
      accounts: {
        create: [
          { id: checking, name: 'Checking', color: '#2563eb', visibility: 0, position: 0 },
          { id: savings, name: 'Savings', color: '#059669', visibility: 1, position: 1 },
          { id: card, name: 'Credit card', color: '#db2777', visibility: 0, position: 2 },
        ],
      },
      labels: {
        create: [
          { id: housing, name: 'Housing', color: '#f59e0b', accountId: checking, position: 0 },
          { id: groceries, name: 'Groceries', color: '#10b981', accountId: checking, position: 1 },
          { id: utilities, name: 'Utilities', color: '#06b6d4', accountId: checking, position: 2 },
          { id: transport, name: 'Transport', color: '#3b82f6', accountId: checking, position: 3 },
          { id: health, name: 'Health', color: '#ec4899', accountId: checking, position: 4 },
          { id: income, name: 'Income', color: '#22c55e', accountId: checking, position: 5 },
          { id: subs, name: 'Subscriptions', color: '#8b5cf6', accountId: card, position: 6 },
        ],
      },
    },
  });

  const incomes = [
    { id: 'demo-inc-salary', name: 'Salary', amount: 2850, day: 10, labelId: income, position: 0 },
    { id: 'demo-inc-benefit', name: 'Family allowance', amount: 140, day: 1, labelId: income, position: 1 },
    { id: 'demo-inc-side', name: 'Weekend freelance', amount: 620, day: 22, labelId: income, position: 2 },
  ];

  const expenses = [
    { id: 'demo-exp-rent', name: 'Rent', amount: 890, day: 1, frequency: 'monthly' as const, month: null, labelId: housing, position: 3 },
    { id: 'demo-exp-kinder', name: 'Kindergarten', amount: 160, day: 5, frequency: 'monthly' as const, month: null, labelId: housing, position: 4 },
    { id: 'demo-exp-grocery', name: 'Groceries', amount: 380, day: 8, frequency: 'monthly' as const, month: null, labelId: groceries, position: 5 },
    { id: 'demo-exp-power', name: 'Electricity', amount: 78, day: 15, frequency: 'monthly' as const, month: null, labelId: utilities, position: 6 },
    { id: 'demo-exp-net', name: 'Internet', amount: 25, day: 5, frequency: 'monthly' as const, month: null, labelId: subs, position: 7 },
    { id: 'demo-exp-netflix', name: 'Netflix', amount: 13.99, day: 12, frequency: 'monthly' as const, month: null, labelId: subs, position: 8 },
    { id: 'demo-exp-spotify', name: 'Spotify', amount: 10.99, day: 12, frequency: 'monthly' as const, month: null, labelId: subs, position: 9 },
    { id: 'demo-exp-phone', name: 'Phone', amount: 18, day: 7, frequency: 'monthly' as const, month: null, labelId: utilities, position: 10 },
    { id: 'demo-exp-fuel', name: 'Fuel', amount: 120, day: 18, frequency: 'monthly' as const, month: null, labelId: transport, position: 11 },
    { id: 'demo-exp-transit', name: 'Transit pass', amount: 35, day: 2, frequency: 'monthly' as const, month: null, labelId: transport, position: 12 },
    { id: 'demo-exp-health', name: 'Health insurance', amount: 54, day: 3, frequency: 'monthly' as const, month: null, labelId: health, position: 13 },
    { id: 'demo-exp-carins', name: 'Car insurance', amount: 390, day: 15, frequency: 'annual' as const, month: 3, labelId: transport, position: 14 },
    { id: 'demo-exp-homeins', name: 'Home insurance', amount: 210, day: 20, frequency: 'annual' as const, month: 1, labelId: housing, position: 15 },
  ];

  await prisma.income.createMany({
    data: incomes.map((row) => ({
      ...row,
      houseId,
      accountId: null,
      isActive: true,
    })),
  });

  await prisma.expense.createMany({
    data: expenses.map((row) => ({
      ...row,
      houseId,
      accountId: null,
      isActive: true,
    })),
  });

  const januaryPlanId = 'demo-plan-home-jan';
  await prisma.monthPlan.create({
    data: {
      id: januaryPlanId,
      houseId,
      monthKey: JANUARY,
      openingBalances: {
        create: [
          { id: 'demo-ob-home-jan-checking', accountId: checking, amount: 2140 },
          { id: 'demo-ob-home-jan-savings', accountId: savings, amount: 6400 },
          { id: 'demo-ob-home-jan-card', accountId: card, amount: -180 },
        ],
      },
    },
  });

  const currentPlanId = 'demo-plan-home-now';
  const today = new Date().getDate();
  const paidIds = [
    'demo-inc-salary',
    'demo-inc-benefit',
    'demo-exp-rent',
    'demo-exp-kinder',
    'demo-exp-grocery',
    'demo-exp-power',
    'demo-exp-net',
    'demo-exp-netflix',
    'demo-exp-spotify',
    'demo-exp-phone',
    'demo-exp-transit',
    'demo-exp-health',
  ].filter((id) => {
    const day =
      incomes.find((row) => row.id === id)?.day ?? expenses.find((row) => row.id === id)?.day ?? 99;
    return day < today;
  });

  await prisma.monthPlan.create({
    data: {
      id: currentPlanId,
      houseId,
      monthKey: CURRENT_MONTH,
      settledItems: {
        create: paidIds.map((itemId, index) => ({
          id: `demo-settled-home-${index}`,
          itemId,
          settled: true,
        })),
      },
      customItems: {
        create: [
          {
            id: 'demo-custom-gift',
            type: 'expense',
            name: 'Birthday gift',
            amount: 75,
            day: Math.min(today + 3, 28),
            accountId: checking,
            labelId: null,
            isPaid: false,
            notes: 'One-off this month',
          },
        ],
      },
    },
  });
}

async function seedStudio(ownerId: string, position: number) {
  const houseId = 'demo-house-studio';
  const operating = 'demo-acc-operating';
  const tax = 'demo-acc-tax';

  const clients = 'demo-lbl-clients';
  const software = 'demo-lbl-software';
  const contractors = 'demo-lbl-contractors';
  const office = 'demo-lbl-office';

  await prisma.house.create({
    data: {
      id: houseId,
      name: 'Northwind Studio',
      description: 'Freelance practice: retainers, tools, and tax reserve',
      icon: 'laptop',
      position,
      ownerId,
      accounts: {
        create: [
          { id: operating, name: 'Operating', color: '#2563eb', visibility: 0, position: 0 },
          { id: tax, name: 'Tax reserve', color: '#d97706', visibility: 1, position: 1 },
        ],
      },
      labels: {
        create: [
          { id: clients, name: 'Clients', color: '#22c55e', accountId: operating, position: 0 },
          { id: software, name: 'Software', color: '#8b5cf6', accountId: operating, position: 1 },
          { id: contractors, name: 'Contractors', color: '#f59e0b', accountId: operating, position: 2 },
          { id: office, name: 'Office', color: '#06b6d4', accountId: operating, position: 3 },
        ],
      },
    },
  });

  await prisma.income.createMany({
    data: [
      { id: 'demo-inc-retainer', houseId, name: 'Design retainer', amount: 2400, day: 5, labelId: clients, position: 0, isActive: true },
      { id: 'demo-inc-project', houseId, name: 'Brand project', amount: 1800, day: 22, labelId: clients, position: 1, isActive: true },
    ],
  });

  await prisma.expense.createMany({
    data: [
      { id: 'demo-exp-adobe', houseId, name: 'Adobe CC', amount: 68, day: 4, frequency: 'monthly', month: null, labelId: software, position: 2, isActive: true },
      { id: 'demo-exp-github', houseId, name: 'GitHub', amount: 4, day: 8, frequency: 'monthly', month: null, labelId: software, position: 3, isActive: true },
      { id: 'demo-exp-contractor', houseId, name: 'Motion contractor', amount: 900, day: 16, frequency: 'monthly', month: null, labelId: contractors, position: 4, isActive: true },
      { id: 'demo-exp-cowork', houseId, name: 'Coworking', amount: 220, day: 1, frequency: 'monthly', month: null, labelId: office, position: 5, isActive: true },
      { id: 'demo-exp-account', houseId, name: 'Accounting', amount: 80, day: 10, frequency: 'monthly', month: null, labelId: office, position: 6, isActive: true },
      { id: 'demo-exp-tax', houseId, name: 'Quarterly tax', amount: 1400, day: 20, frequency: 'annual', month: 3, labelId: null, accountId: tax, position: 7, isActive: true },
    ],
  });

  await prisma.monthPlan.create({
    data: {
      id: 'demo-plan-studio-jan',
      houseId,
      monthKey: JANUARY,
      openingBalances: {
        create: [
          { id: 'demo-ob-studio-jan-op', accountId: operating, amount: 4120 },
          { id: 'demo-ob-studio-jan-tax', accountId: tax, amount: 2600 },
        ],
      },
    },
  });
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set.');
  }
  if (!process.env.BETTER_AUTH_SECRET) {
    throw new Error('BETTER_AUTH_SECRET is not set.');
  }

  const userId = await ensureDemoUser();
  await prisma.house.deleteMany({ where: { ownerId: userId } });
  await seedHome(userId, 0);
  await seedStudio(userId, 1);

  console.log(`Seeded README demo for ${DEMO_EMAIL}`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
