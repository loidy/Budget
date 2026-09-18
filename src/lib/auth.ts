import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { nextCookies } from 'better-auth/next-js';
import { prisma } from './prisma';

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

export const googleAuthEnabled = Boolean(googleClientId && googleClientSecret);

/** Shared Better Auth instance. CLI tools skip the Next.js cookie plugin. */
export function createAuth(options: { withNextCookies?: boolean } = {}) {
  return betterAuth({
    appName: 'House & Business Budget Planner',
    baseURL: process.env.BETTER_AUTH_URL,
    secret: process.env.BETTER_AUTH_SECRET,
    trustedOrigins: process.env.BETTER_AUTH_URL ? [process.env.BETTER_AUTH_URL] : [],
    database: prismaAdapter(prisma, { provider: 'postgresql' }),
    emailAndPassword: { enabled: true },
    socialProviders: googleAuthEnabled
      ? {
          google: {
            clientId: googleClientId!,
            clientSecret: googleClientSecret!,
            prompt: 'select_account',
          },
        }
      : undefined,
    plugins: options.withNextCookies === false ? [] : [nextCookies()],
  });
}

export const auth = createAuth();
