# syntax=docker/dockerfile:1

# Debian rather than Alpine so Tailwind's oxide engine and the Next.js SWC
# binaries use their native glibc builds instead of the wasm fallbacks.
ARG NODE_VERSION=24-bookworm-slim

# ---------------------------------------------------------------------------
# Shared base
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# ---------------------------------------------------------------------------
# Dependencies, cached independently of the application source
# ---------------------------------------------------------------------------
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# ---------------------------------------------------------------------------
# Development: Compose bind-mounts the source over /app, so this stage only
# needs the toolchain and a generated Prisma client.
# ---------------------------------------------------------------------------
FROM base AS dev
ENV NODE_ENV=development
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
EXPOSE 3000
CMD ["npm", "run", "dev"]

# ---------------------------------------------------------------------------
# Production build
# ---------------------------------------------------------------------------
FROM base AS builder
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# `next build` never touches the database, but Prisma's config loader still
# expects the variable to be defined. Better Auth also reads its env at import.
ENV DATABASE_URL=""
ENV BETTER_AUTH_SECRET="build-placeholder"
ENV BETTER_AUTH_URL="http://localhost:3000"
RUN npm run build

# ---------------------------------------------------------------------------
# Production runtime: Next.js standalone server. Prisma CLI, migrations, and
# create-superuser live here too so deploy is `compose up`, then commands on
# this service — not a second image.
# ---------------------------------------------------------------------------
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV HOME=/tmp
ENV NPM_CONFIG_CACHE=/tmp/.npm

RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
# Full node_modules (replaces the traced standalone set) so `prisma` and `tsx` work.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/package.json /app/tsconfig.json /app/prisma.config.ts ./
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts
COPY --from=builder --chown=nextjs:nodejs /app/src ./src

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
