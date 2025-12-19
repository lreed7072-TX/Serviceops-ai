# Field Service AI (MVP)

AI-backed, multi-tenant field service management MVP built with Next.js App Router, Prisma, and Postgres.

## Requirements
- Node.js 20+
- Docker (optional, for local Postgres)

## Local Setup
1. Start Postgres:
   ```bash
   docker-compose up -d
   ```
2. Copy env vars:
   ```bash
   cp .env.example .env
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Run migrations + Prisma client:
   ```bash
   npm run prisma:migrate
   npm run prisma:generate
   ```
5. Start the dev server:
   ```bash
   npm run dev
   ```

## Auth + Org Scoping (MVP)
All API routes expect headers to scope data to an org and user:
- `x-org-id`
- `x-user-id`
- `x-role` (`ADMIN`, `DISPATCHER`, `TECH`)

Every query enforces `orgId` filtering. Use the invite flow below to create users, or seed users manually with Prisma.

## Invite-only onboarding
- Create invite (admin only): `POST /api/invites`
  ```json
  { "email": "tech@company.com", "role": "TECH" }
  ```
- Accept invite: `POST /api/invites/accept`
  ```json
  { "token": "...", "name": "Taylor Tech" }
  ```

## CRUD APIs
Minimal org-scoped CRUD is implemented for:
- `customers`
- `sites`
- `assets`
- `work-orders`
- `visits`

Example:
```bash
curl -X POST http://localhost:3000/api/customers \
  -H "Content-Type: application/json" \
  -H "x-org-id: <org-id>" \
  -H "x-user-id: <user-id>" \
  -H "x-role: ADMIN" \
  -d '{"name": "Acme Facilities"}'
```

## Closeout Gate
Use `GET /api/visits/:id/closeout-gate` to return missing required fields (status, completedAt, summary, outcome, findings, measurements).

## Pgvector (Optional)
Embeddings are stored as JSON by default. If you want pgvector support, run:
```bash
psql "$DATABASE_URL" -f prisma/pgvector.sql
```
This adds a `embedding_vector` column and index on `KbChunk`.

## Scripts
- `npm run dev` - start Next.js dev server
- `npm run build` - production build
- `npm run lint` - ESLint
- `npm run prisma:migrate` - create/apply Prisma migrations
- `npm run prisma:generate` - generate Prisma client
