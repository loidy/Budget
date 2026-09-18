import { getTranslations } from 'next-intl/server';

type ErrorKey = Parameters<Awaited<ReturnType<typeof getTranslations<'errors'>>>>[0];

export async function errorText(key: string): Promise<string> {
  const t = await getTranslations('errors');
  return t(key as ErrorKey);
}

export async function fail(key: string): Promise<never> {
  throw new Error(await errorText(key));
}
