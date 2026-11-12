# ticketing-system

A PERN ticketing app for races: a buyer holds a place and pays through Midtrans Sandbox (or a local payment simulator), and staff check the named participant in at the event.

- **API:** Express 5, Drizzle ORM, PostgreSQL 18, Redis 8, Better Auth sessions. It owns every rule.
- **Web:** Next.js (App Router) and Tailwind. It is UI only; `/api/*` is forwarded to the API by `apps/web/proxy.ts`, so session cookies stay same-origin.
- Roles: `buyer`, `staff` and `admin`.

## Setup

Prerequisites: Node.js 26 and Docker.

```bash
cp .env.example .env          # change ports here if 3000/4000/5432/6379 are taken
docker compose up -d --wait   # Postgres + Redis (also creates ticketing_test)
npm install
npm run db:migrate
npm run db:seed
npm run dev                   # API (API_PORT) + web (WEB_PORT)
```

Open the web app at `WEB_ORIGIN` (default http://localhost:3000).

Seeded accounts all use the password `workshop-password`: `buyer@`, `admin@` and `staff1@`–`staff3@example.com`. Change or remove them before any public deployment.

## Commands

```bash
npm test                      # API tests (Vitest + Supertest on ticketing_test)
npm run test:e2e              # Playwright; starts its own servers and uses the test database
npm run lint && npm run typecheck && npm run format:check
npm run build                 # production build of both apps
npm run db:generate           # after changing a schema file
npm run reconcile             # settle every pending order past its deadline now
npm run staff:assign -- --event <slug> --email <staff email>   # staff assignments have no UI
```

## Payments

- `PAYMENT_PROVIDER=simulator` (default): a simulator page can pay, send a notification twice, fail, make the provider unreachable, and advance the API's clock. Its notifications are unsigned, so the API refuses it when `NODE_ENV=production`.
- `PAYMENT_PROVIDER=midtrans` with `MIDTRANS_SERVER_KEY` (sandbox): checkout redirects to Midtrans Snap. Payments settle without a public URL because the app asks the Midtrans Status API when the buyer returns and after the payment deadline. To receive live callbacks, set the Midtrans notification URL to `https://<domain>/api/payments/notifications`.

## Deploy to Coolify

`compose.coolify.yaml` runs Postgres, Redis, the API and the web app as one Docker Compose resource, built from the root `Dockerfile` (targets `api` and `web`). It uses Midtrans Sandbox with `NODE_ENV=production`.

1. In Coolify, create a resource from this repository with the **Docker Compose** build pack and compose file `/compose.coolify.yaml`.
2. Give the `web` service a domain. It listens on port 3000; the API has no public port.
3. Set `MIDTRANS_SERVER_KEY` (required) and `MIDTRANS_CLIENT_KEY`. Coolify generates the database credentials and the auth secret.
4. Deploy. Each start of the API container runs migrations, then the (idempotent) seed, then the server.
5. In the Midtrans sandbox dashboard, set the payment notification URL to `https://<domain>/api/payments/notifications`.

Run the CLIs from the `api` container's terminal (working directory `apps/api`):

```bash
node src/staff/assign-cli.ts --event <slug> --email <staff email>
node src/reconciliation/cli.ts
```

After changing the domain, redeploy: the API reads the public URL from `SERVICE_URL_WEB`.
