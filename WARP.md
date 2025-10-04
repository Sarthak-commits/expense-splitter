# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

Project overview
- App: Next.js 15 (App Router, TypeScript, Tailwind v4)
- Auth: NextAuth Credentials with JWT sessions
- Data: Prisma ORM; SQLite for local dev via DATABASE_URL; migrations present
- Structure highlights:
  - src/app: App Router pages and route handlers
  - src/lib/db.ts: Prisma Client singleton for hot-reload safety
  - src/lib/auth.ts: NextAuth config (Credentials authorize with bcrypt, Prisma lookups)
  - API routes: /api/auth/register, /api/auth/[...nextauth], /api/groups
  - Path alias: @/* → ./src/* (see tsconfig.json)

Environment
- Copy .env.example contents from README into .env (at repo root): DATABASE_URL, NEXTAUTH_URL, NEXTAUTH_SECRET
- Local defaults (from README): DATABASE_URL="file:./dev.db", NEXTAUTH_URL="http://localhost:3000"

Common commands
- Install deps
  - npm ci
- Generate Prisma Client (required before dev or build)
  - npm run prisma:generate
- Start dev server (Turbopack)
  - npm run dev
- Type check
  - npm run typecheck
- Lint (entire repo)
  - npm run lint -- .
- Lint (single file)
  - npm run lint -- src/app/groups/page.tsx
- Build (Turbopack)
  - npm run build
- Start production server
  - npm run start
- Database (schema changes)
  - Create and apply a dev migration with a name
    - npm run prisma:migrate -- --name <migration_name>
  - Push schema without creating a migration (dev only)
    - npm run db:push

Notes on testing
- No test runner/config is present (no test scripts, Jest/Vitest config, or tests directory). Add a test framework before attempting to run tests.

High-level architecture
- Next.js App Router
  - Server components fetch data with Prisma directly (e.g., src/app/groups/page.tsx):
    - Reads session via getServerSession(authOptions)
    - Queries prisma.group with membership filter and renders list
  - Client components handle interactivity and call API routes
    - src/components/CreateGroupForm.tsx posts to /api/groups then reloads
  - Global layout and styles in src/app/layout.tsx and src/app/globals.css
  - Client session access via NextAuth SessionProvider
    - Wrapper: src/components/Providers.tsx (client) → used in src/app/layout.tsx
    - In client components: import { useSession, signOut } from 'next-auth/react'
- Authentication
  - src/lib/auth.ts defines authOptions for NextAuth
    - Credentials provider validates email/password via zod, compares bcrypt hashes, returns minimal user object
    - JWT callback attaches user id to token; session callback mirrors id onto session.user
  - Route handler at src/app/api/auth/[...nextauth]/route.ts exports NextAuth handler as GET/POST
  - Login page (client) uses signIn('credentials'); Register page (client) calls /api/auth/register
- API routes
  - POST /api/auth/register: Validates input, ensures unique email, stores hashed password
  - GET/POST /api/groups: Requires session; lists groups for the user; creates a group and adds creator as OWNER
- Data layer (Prisma)
  - Prisma Client singleton pattern in src/lib/db.ts prevents multiple clients in dev
  - Schema models (see prisma/schema.prisma): User, Group, GroupMember, Expense, ExpenseSplit, Settlement
    - Groups have creator, members, expenses, and settlements
    - Expense splits model per-user owed amounts per expense
  - Migrations are present in prisma/migrations/

Operational tips
- Ensure npm run prisma:generate is executed whenever the Prisma schema changes
- For Postgres in production, follow README steps (update datasource provider and run migrations)

Verification: Session Provider
- Start dev: npm run dev
- Register or sign in, then in a client component call useSession() to access session; signOut() should log you out

References
- README.md: Environment setup, CI example, and Vercel deployment notes
