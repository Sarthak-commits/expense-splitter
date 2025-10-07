# Expense Splitter

Full-stack Next.js app to split expenses with friends, track per-user balances, and settle up.

Tech stack
- Next.js App Router (TypeScript, Tailwind)
- Prisma ORM
- SQLite (dev) → Postgres (prod)
- NextAuth (Credentials provider, JWT sessions)

## Local development

1) Requirements
- Node 18+
- npm
- Git (optional for local, required for GitHub)

2) Configure env
Copy `.env.example` to `.env` and adjust if needed.

```
DATABASE_URL="file:./dev.db"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="devsecret-change-me"
```

3) Generate Prisma Client

```
npm run prisma:generate
```

4) Start dev server

```
npm run dev
```

Open http://localhost:3000.

- Register: /auth/register
- Sign in: /auth/login
- Groups: /groups

## Database
- Dev uses SQLite file prisma/dev.db.
- For production, switch datasource to Postgres (Supabase/Neon) and set DATABASE_URL accordingly, then run migrations.

## Switch to Postgres (prod)
- Create a Postgres database (Supabase/Neon).
- Set DATABASE_URL in production to the Postgres URL.
- Update `datasource db { provider = "postgresql" }` in `prisma/schema.prisma`.
- Create an initial migration and apply:

```
npm run prisma:migrate -- --name init
```

## CI
A simple GitHub Actions workflow can run typecheck/lint/build. After pushing to GitHub, create `.github/workflows/ci.yml` like:

```
name: CI
on: [push, pull_request]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 18
      - run: npm ci
      - run: npm run prisma:generate
      - run: npm run typecheck
      - run: npm run lint
      - run: npm run build
```

## Deploy (Vercel)
- Push repo to GitHub
- Import into Vercel
- Set env vars: DATABASE_URL, NEXTAUTH_URL, NEXTAUTH_SECRET
- If using Postgres, ensure migrations are applied in prod.

## Production Deployment

### Quick Deploy to Vercel
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Sarthak-commits/expense-splitter)

### Manual Deployment
See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions.

**Requirements for Production:**
- PostgreSQL database (Supabase, Neon, Railway, etc.)
- Vercel account (free tier works)
- Environment variables configured

**Quick Setup:**
1. Fork this repository
2. Create PostgreSQL database on Supabase
3. Deploy to Vercel with environment variables
4. Run database migrations
5. Your app is live! 🚀

## Roadmap
- ✅ Add members to groups (invites)
- ✅ Add expenses and compute balances  
- ✅ Record settlements and show net owed/owes
- ✅ CSV export and email summaries
- ✅ Mobile-responsive design
- ✅ Production deployment ready
