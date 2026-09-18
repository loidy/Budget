import 'dotenv/config';
import { parseArgs } from 'node:util';
import { createAuth } from '../src/lib/auth';
import { prisma } from '../src/lib/prisma';
import * as v from '../src/lib/validation';

function usage(): void {
  console.error(`Create a sign-in account (email + password).

Usage:
  npm run create-superuser -- --email EMAIL --password PASSWORD [--name NAME]

Flags can also come from the environment:
  SUPERUSER_EMAIL
  SUPERUSER_PASSWORD
  SUPERUSER_NAME
`);
}

function fail(message: string, code = 1): never {
  console.error(message);
  process.exit(code);
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      email: { type: 'string', short: 'e' },
      password: { type: 'string', short: 'p' },
      name: { type: 'string', short: 'n' },
      help: { type: 'boolean', short: 'h', default: false },
    },
    strict: true,
  });

  if (values.help) {
    usage();
    return;
  }

  const emailRaw = values.email ?? process.env.SUPERUSER_EMAIL;
  const passwordRaw = values.password ?? process.env.SUPERUSER_PASSWORD;
  const nameRaw = values.name ?? process.env.SUPERUSER_NAME;

  if (!emailRaw || !passwordRaw) {
    usage();
    fail('Email and password are required.');
  }

  if (!process.env.DATABASE_URL) {
    fail('DATABASE_URL is not set.');
  }

  if (!process.env.BETTER_AUTH_SECRET) {
    fail('BETTER_AUTH_SECRET is not set.');
  }

  let email: string;
  let password: string;
  try {
    email = v.email(emailRaw);
    password = v.password(passwordRaw);
  } catch (error) {
    fail(error instanceof Error ? error.message : 'Invalid email or password.');
  }

  const name = (nameRaw?.trim() || email.split('@')[0] || 'Admin').slice(0, 200);

  const auth = createAuth({ withNextCookies: false });
  const ctx = await auth.$context;
  const existing = await ctx.internalAdapter.findUserByEmail(email);

  if (existing?.user) {
    fail(`A user with email ${email} already exists.`);
  }

  const hash = await ctx.password.hash(password);
  const user = await ctx.internalAdapter.createUser(
    {
      email,
      name,
      emailVerified: true,
    },
    { method: "admin" }
  );

  if (!user) {
    fail('Failed to create the user.');
  }

  await ctx.internalAdapter.linkAccount({
    userId: user.id,
    providerId: 'credential',
    accountId: user.id,
    password: hash,
  });

  console.log(`Created user ${user.email}`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
