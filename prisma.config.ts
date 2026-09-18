import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // Read directly rather than via env() so `prisma generate` also works
    // during image builds, where no database URL is available.
    url: process.env.DATABASE_URL ?? '',
  },
});
