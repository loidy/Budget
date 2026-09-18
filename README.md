# House & Business Budget Planner

Multi-house cash flow planner: master catalogs of recurring income and expenses,
per-month deviations, label-driven account routing, and a daily cash flow projection.

![Demo of the planner: daily cash-flow chart, monthly plan, recurring catalog, and switching between a household and a business budget](docs/demo.gif)

Next.js (App Router) + PostgreSQL + Prisma + Better Auth, containerized with Docker Compose.

## Quick start

```bash
cp .env.example .env
# Set BETTER_AUTH_SECRET to a long random string, e.g. `openssl rand -base64 32`
docker compose up --build -d
docker compose exec web npm run prisma:deploy
```

Open http://localhost:3000 and create an account, or create the first user
from the CLI (see Production below). An empty account starts with no houses.

If port 3000 or 5432 is already taken, override the host ports in `.env`:

```bash
WEB_PORT=3100
POSTGRES_PORT=5433
BETTER_AUTH_URL=http://localhost:3100
```

## How it works

The app is a single dynamic page behind Better Auth. Data is read on the server
for the signed-in user, mutated through server actions, and re-rendered from
the database after every write.

| Path | Purpose |
| --- | --- |
| `src/app/page.tsx` | Server component; requires a session, loads that user's houses |
| `src/app/login/page.tsx` | Email/password sign-in and sign-up, optional Google |
| `src/app/api/auth/[...all]/route.ts` | Better Auth HTTP handler |
| `src/components/BudgetApp.tsx` | Client shell: tabs, selected month, optimistic updates |
| `src/components/*.tsx` | The views (cash flow chart, tables, timeline, managers) |
| `src/actions/*.ts` | Server actions — the only place that writes to the database |
| `src/lib/auth.ts` | Better Auth config (Prisma adapter, email/password, Google) |
| `src/lib/auth-guard.ts` | Session and house ownership/membership checks |
| `src/lib/houses.ts` | Loads rows and maps them to the `House` shape the UI expects |
| `src/utils/budgetLogic.ts` | Pure domain logic: plan resolution and cash flow |
| `prisma/schema.prisma` | Database schema |

Mutations are applied to a local copy with `useOptimistic` first, so the UI
responds immediately, then persisted. Ids are generated on the client so the
optimistic row and the stored row share an identity. If an action fails, React
rolls the change back and a banner explains why.

### Auth and sharing

Houses belong to the user who created them. The owner can share a house with
any existing user (by email). Members can edit the budget; only the owner can
delete the house or change sharing.

Any signed-in user can create additional accounts from **Používatelia** (no
seat limit). Public self-signup and optional Google OAuth stay available.
The CLI `create-superuser` command is the other way to create the first user
after a deploy, without opening the sign-up form.

### Data model

A `House` owns accounts, labels, and the master catalogs of `Income` and
`Expense` rows. Recurring items live in the catalog once; a `MonthPlan` records
only how a given month deviates from it:

- `PlanOverride` — a catalog item with a different amount, day, or account this month
- `CustomItem` — a one-off that exists only in this month
- `SettledItem` — marks an item paid within this month

A label tied to an account overrides the account of every item carrying it, which
is how e.g. all subscriptions land on the card account.

Amounts are `Decimal(14,2)` in Postgres and plain numbers in the UI; negative
amounts are meaningful (offsets and reimbursements).

## Development

`docker compose up` bind-mounts the source, so edits hot-reload. `node_modules`,
`.next`, and the generated Prisma client live in named volumes so container
builds never write root-owned files into your working tree.

```bash
docker compose up              # start
docker compose exec web npm run prisma:deploy   # apply migrations
docker compose logs -f web     # app logs
docker compose down            # stop (keeps data)
docker compose down -v         # stop and delete the database
```

Useful commands, run from the host against the exposed Postgres port:

```bash
npm install                    # needed once for editor IntelliSense
npx prisma studio              # browse the data
npx prisma migrate dev --name <name>   # create a migration after editing the schema
npm run lint                   # typecheck
```

After changing `prisma/schema.prisma`, create the migration on the host as above;
the container regenerates its Prisma client on the next start.

### Running without Docker

You need a PostgreSQL 17 instance and `DATABASE_URL` plus `BETTER_AUTH_SECRET`
in `.env`:

```bash
npm install
npx prisma migrate deploy
npm run create-superuser -- --email you@example.com --password '<password>' --name 'Your Name'
npm run dev
```

## Production

The image `ghcr.io/loidy/budget` is published from `main` and `v*.*.*` tags.
After the first workflow run, make the package public (Package settings →
Change visibility → Public) so it can be pulled without logging in.

Deploy in three steps: start the stack, apply migrations, create the first user.

```bash
POSTGRES_PASSWORD=<strong-password> \
BETTER_AUTH_SECRET=<long-random-string> \
BETTER_AUTH_URL=https://budget.example.com \
docker compose -f compose.prod.yaml pull
docker compose -f compose.prod.yaml up -d

docker compose -f compose.prod.yaml exec web npm run prisma:deploy

docker compose -f compose.prod.yaml exec \
  -e SUPERUSER_EMAIL=you@example.com \
  -e SUPERUSER_PASSWORD='<password>' \
  -e SUPERUSER_NAME='Your Name' \
  web npm run create-superuser
```

Pin a specific build with `IMAGE_TAG` (for example `sha-abc1234` or `1.0.0`).
To compile from this tree instead of pulling, add `--build` to `up`.

Prefer environment variables for `create-superuser` so the password does not
appear in process lists. Against a host `DATABASE_URL`:

```bash
npm run create-superuser -- --email you@example.com --password '<password>' --name 'Your Name'
```

An empty account has no houses; create one in the app after sign-in.

Postgres is not published to the host in this stack — only the web service is.
Put a TLS-terminating reverse proxy in front of it before exposing it publicly.

Google OAuth is optional. If you enable it, add
`${BETTER_AUTH_URL}/api/auth/callback/google` as an authorized redirect URI.

## Environment variables

| Variable | Used by | Default |
| --- | --- | --- |
| `POSTGRES_USER` | both stacks | `budget` |
| `POSTGRES_PASSWORD` | both stacks | `budget` in dev, required in production |
| `POSTGRES_DB` | both stacks | `budget` |
| `POSTGRES_PORT` | dev only, host port | `5432` |
| `WEB_PORT` | host port for the app | `3000` |
| `IMAGE_TAG` | prod compose, GHCR tag for `web` | `latest` |
| `DATABASE_URL` | host-side Prisma CLI and non-Docker runs | see `.env.example` |
| `BETTER_AUTH_SECRET` | web, `create-superuser` | required |
| `BETTER_AUTH_URL` | web | `http://localhost:3000` in dev, required in production |
| `GOOGLE_CLIENT_ID` | web | empty (Google button hidden) |
| `GOOGLE_CLIENT_SECRET` | web | empty |
| `SUPERUSER_EMAIL` | `create-superuser` CLI | — |
| `SUPERUSER_PASSWORD` | `create-superuser` CLI | — |
| `SUPERUSER_NAME` | `create-superuser` CLI | local-part of the email |

Compose injects its own `DATABASE_URL` (pointing at the `db` service) into the
containers, so the value in `.env` is only used when you run commands on the host.
