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
- Group detail page
  - Route: src/app/groups/[id]/page.tsx (server component)
  - Access control: only creator or members can view; non-members 404
  - Renders: group name, member list, recent expenses (last 10), and an "Add expense" form (equal split) plus a Balances placeholder
- Expense creation
  - API: POST /api/groups/[id]/expenses
  - AuthZ: requester must be creator or member
  - Input: { description, amount, currency="USD" }
  - Behavior: creates Expense (paidBy = current user) and equal ExpenseSplits across all members
- Balances (basic)
  - Computation on server in group page: for each user, net = (sum paid) - (sum owed via ExpenseSplits) + (sent settlements) - (received settlements)
  - Positive = user is owed; Negative = user owes
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

Verification: Group Detail Page
- Create a group at /groups, then click into the group link
- Expected: group page shows Members, an Add expense form, Recent expenses (possibly empty), and "Balances (coming soon)"
- Non-members attempting to open the URL should receive a 404

Verification: Expense Creation (Equal split)
- Open /groups/[id]
- Enter a description and amount (e.g., 12.34) and submit
- Expected: form clears and the new expense appears in the Expenses list; multiple members should be split equally (server-side)

Verification: Expense Display (pagination)
- Open /groups/[id]
- You should see up to 20 most recent expenses
- If there are more, a "Load more" link appears; clicking it appends ?cursor=... and shows the next page

Verification: Balances
- Open /groups/[id]
- For each member, the balance line should read one of: "settled", "is owed {amount}", or "owes {amount}"
- Create an expense and confirm balances move as expected (payer increases; others decrease)
- After recording settlements in the future, net balances should adjust accordingly

Verification: Navigation and Logout
- Start dev: npm run dev
- Header should show "Expense Splitter" and a Groups link
- When signed out: links to Sign in and Create account are visible
- When signed in: shows your name/email and a Log out button; clicking Log out returns to the home page

References
- README.md: Environment setup, CI example, and Vercel deployment notes
