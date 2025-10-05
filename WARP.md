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
- Copy .env.example to .env (at repo root) and adjust: DATABASE_URL, NEXTAUTH_URL, NEXTAUTH_SECRET
- Local defaults: DATABASE_URL="file:./dev.db", NEXTAUTH_URL="http://localhost:3000"
- Seed data for local dev:
  - npm run prisma:generate
  - npm run prisma:migrate -- --name init-or-update
  - npm run prisma:seed

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
- Vitest is configured via package.json scripts (no extra config required for pure unit tests).
- Run tests:
  - npm run test (CI/one-off)
  - npm run test:watch (local TDD)
- Current coverage focuses on:
  - Equal-split rounding logic (src/lib/split.ts)
  - Balance computation (src/lib/balances.ts)
  - Shared input schemas (src/lib/schemas.ts)

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
  - DELETE /api/groups/[id]: Owner-only delete; cascades related data in a transaction
  - POST /api/groups/[id]/leave: Member leaves group (owner cannot leave)
  - POST /api/groups/[id]/transfer-ownership: Owner moves ownership to another member
  - POST /api/groups/[id]/invites: Owner creates invite for an email (returns token)
  - POST /api/invites/accept: Authenticated user with matching email accepts invite token
  - GET /api/groups/[id]/settlement-suggestions: Enhanced algorithm returns optimized settlement suggestions with user details, summary statistics, and optional balance details (add ?details=true)
  - GET/POST /api/groups/[id]/settlements: Retrieve paginated settlements or create new settlement records with enhanced validation
  - GET/POST/PATCH/DELETE /api/groups/[id]/members: Comprehensive member management with role-based permissions
  - GET/PATCH/DELETE /api/expenses/[expenseId]: Enhanced expense management with detailed permissions and split updates
  - GET/POST /api/groups/[id]/invites: Enhanced invitation system with email notifications and expiration tracking
  - POST /api/invites/accept: Enhanced invitation acceptance with notification emails and detailed responses
  - GET/POST /api/groups/[id]/export: Comprehensive data export system with multiple formats and filtering options
- Group detail page
  - Route: src/app/groups/[id]/page.tsx (server component)
  - Access control: only creator or members can view; non-members 404
  - Renders: group name, member list, recent expenses (last 10), and an "Add expense" form (equal split) plus a Balances placeholder
- Expense creation
  - API: POST /api/groups/[id]/expenses
  - AuthZ: requester must be creator or member
  - Input: { description, amount, currency="USD", splitType?="EQUAL" | "EXACT", splits?=[{userId, amount}] }
  - Validation: currency restricted to USD (server + client), amount must be a positive number with up to 2 decimals; for EXACT, split amounts must be >= 0 and sum to total
  - Behavior: creates Expense (paidBy = current user)
    - EQUAL: server computes equal ExpenseSplits across all members (rounded, sums to total)
    - EXACT: server validates provided per-member amounts and creates ExpenseSplits
    - PERCENT: server validates percents sum to 100 and converts to amounts that sum to total (rounded)
- Balances (basic)
  - Computation on server in group page: for each user, net = (sum paid) - (sum owed via ExpenseSplits) + (sent settlements) - (received settlements)
  - Positive = user is owed; Negative = user owes
- Data layer (Prisma)
  - Prisma Client singleton pattern in src/lib/db.ts prevents multiple clients in dev
  - Schema models (see prisma/schema.prisma): User, Group, GroupMember, Expense, ExpenseSplit, Settlement, Invitation
    - Groups have creator, members, expenses, settlements, and pending invitations
    - Expense splits model per-user owed amounts per expense
  - Migrations are present in prisma/migrations/
- Note: New Invitation model added. Run a migration after pulling changes:
    - npm run prisma:migrate -- --name add-invitations
    - If you need to reset dev DB: npx prisma migrate reset (destructive!)

- Expense editing/deleting
  - API: PATCH/DELETE /api/expenses/[expenseId]
  - Permissions: only payer or group owner can modify/delete an expense
  - PATCH supports updating description, currency, and amount; can also switch to EXACT or PERCENT splits with provided data

- Settlement Management (Enhanced)
  - API: GET/POST /api/groups/[id]/settlements
  - GET: Retrieve paginated settlement history with user details (supports ?limit=N&cursor=ID)
  - POST: Record new settlement with validation (only payer or group owner can record)
  - Input: { fromUserId, toUserId, amount }
  - Returns: Settlement details with user information and creation timestamp
  - Enhanced validation: Prevents self-settlements, validates group membership, enforces permissions

- Settlement Suggestions (Enhanced)
  - API: GET /api/groups/[id]/settlement-suggestions
  - Advanced debt optimization algorithm minimizes transaction count
  - Returns: Optimized settlement suggestions with user names/emails
  - Query params: ?details=true includes comprehensive balance breakdown
  - Summary statistics: total debt, transaction count, creditor/debtor counts
  - Supports complex multi-party debt resolution

- Member Management (Comprehensive)
  - API: GET/POST/PATCH/DELETE /api/groups/[id]/members
  - GET: List all members with roles, join dates, and user details
  - POST: Add member by email with role assignment (OWNER/ADMIN can add, OWNER can assign ADMIN)
  - PATCH: Update member roles (OWNER only, cannot assign OWNER role)
  - DELETE: Remove members with hierarchical permissions (OWNER > ADMIN > MEMBER, self-removal allowed)
  - Role-based permissions: OWNER (creator), ADMIN (can manage members), MEMBER (basic access)
  - Prevents: Owner removal, owner role assignment (use transfer-ownership)

- Expense Management (Enhanced)
  - API: GET/PATCH/DELETE /api/expenses/[expenseId]
  - GET: Retrieve expense details with split information and modification permissions
  - PATCH: Update expense description, amount, currency, and split types with validation
  - DELETE: Remove expenses with proper authorization (payer, group owner, or admin)
  - Permissions: Enhanced hierarchy - payer, group owner, or group admin can modify
  - Split updates: Supports EQUAL, EXACT split type changes with automatic recalculation
  - Validation: Ensures split amounts sum to total, prevents unauthorized modifications

- Email Integration (Complete)
  - Service: Comprehensive email service with HTML templates and notification system
  - Invitation emails: Professional templates with group details and accept links
  - Notification emails: Acceptance confirmations and group activity updates
  - API: Enhanced GET/POST /api/groups/[id]/invites with email sending
  - API: Enhanced POST /api/invites/accept with notification emails
  - Features: Email personalization, expiration tracking, invitation management
  - Configuration: Supports multiple email providers (SendGrid, SMTP, etc.)

- Data Export (Comprehensive)
  - API: GET/POST /api/groups/[id]/export
  - Formats: CSV export with multiple data types (expenses, settlements, members, balances)
  - Export types: Individual exports or comprehensive group summary
  - Features: Date filtering, custom configurations, proper CSV formatting
  - Security: Member-level access control, secure file downloads
  - Data integrity: Includes balance calculations and expense split details

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

Verification: Expense Creation (Equal/Custom)
- Open /groups/[id]
- Enter a description and amount; choose Equal or Custom split.
- For Custom, input amounts for each member that sum exactly to the total.
- Expected: form clears and the new expense appears in the Expenses list; equal split is computed server-side, custom amounts are stored as provided.

Verification: Expense Display (pagination)
- Open /groups/[id]
- You should see up to 20 most recent expenses
- If there are more, a "Load more" link appears; clicking it appends ?cursor=... and shows the next page

Verification: Balances
- Open /groups/[id]
- For each member, the balance line should read one of: "settled", "is owed {amount}", or "owes {amount}"
- Create an expense and confirm balances move as expected (payer increases; others decrease)
- After recording settlements in the future, net balances should adjust accordingly

Verification: Settlement Management
- Open /groups/[id] and navigate to settlements section
- Record a settlement between members using the settlement form
- Expected: Settlement appears in history with user details and timestamp
- Balances should update to reflect the settlement
- Test settlement suggestions to see optimized payment recommendations

Verification: Member Management
- Open /groups/[id] and navigate to members section
- As group owner: Add members by email, assign roles (ADMIN/MEMBER)
- Update member roles using the role management interface
- Remove members (test permission hierarchy: owner > admin > member)
- As non-owner: Verify limited permissions (cannot add/remove members unless admin)

Verification: Enhanced Expense Management
- Open /groups/[id] and view existing expenses
- As expense payer: Edit expense details, amount, and split types
- As group owner/admin: Modify any expense in the group
- Test expense deletion with proper permission validation
- Verify split recalculation when amounts change

Verification: Email Integration
- Create group invitations and verify invitation emails are sent
- Accept invitations and confirm acceptance notification emails
- Check email templates render properly with group and user details
- Test invitation expiration and email personalization

Verification: Data Export
- Navigate to /groups/[id] export section
- Test different export types: expenses, settlements, members, balances, summary
- Verify CSV file downloads with proper formatting and data integrity
- Test custom export configurations with date filtering
- Confirm exported data matches group information accurately

Verification: Navigation and Logout
- Start dev: npm run dev
- Header should show "Expense Splitter" and a Groups link
- When signed out: links to Sign in and Create account are visible
- When signed in: shows your name/email and a Log out button; clicking Log out returns to the home page

References
- README.md: Environment setup, CI example, and Vercel deployment notes
