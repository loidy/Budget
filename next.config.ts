import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  // Emits a self-contained server bundle so the production image can stay slim.
  output: 'standalone',
};

export default withNextIntl(nextConfig);
