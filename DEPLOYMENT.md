# Production Deployment Guide

This guide walks you through deploying the Expense Splitter application to production using Vercel and PostgreSQL.

## Prerequisites

- GitHub account with the expense-splitter repository
- Vercel account (free tier is sufficient)
- Supabase account or other PostgreSQL provider

## Step 1: Set up PostgreSQL Database

### Option A: Supabase (Recommended)
1. Go to [supabase.com](https://supabase.com) and create an account
2. Create a new project
3. Navigate to Settings > Database
4. Copy the connection string (starts with `postgresql://`)
5. Replace the placeholder password with your actual password

### Option B: Other PostgreSQL Providers
- **Neon**: [neon.tech](https://neon.tech)
- **PlanetScale**: [planetscale.com](https://planetscale.com) 
- **Railway**: [railway.app](https://railway.app)
- **Render**: [render.com](https://render.com)

## Step 2: Deploy to Vercel

1. **Connect Repository**
   - Go to [vercel.com](https://vercel.com) and sign up/login
   - Click "New Project" 
   - Import your `expense-splitter` GitHub repository

2. **Configure Environment Variables**
   In Vercel project settings, add these environment variables:

   ```
   DATABASE_URL=postgresql://your-connection-string
   NEXTAUTH_URL=https://your-app.vercel.app
   NEXTAUTH_SECRET=your-super-secret-jwt-secret-min-32-chars
   EMAIL_FROM=noreply@yourdomain.com
   SENDGRID_API_KEY=your-sendgrid-api-key (optional)
   ```

3. **Deploy**
   - Click "Deploy" 
   - Vercel will automatically build and deploy your application
   - The first deployment may take 2-3 minutes

## Step 3: Run Database Migrations

After successful deployment:

1. **Via Vercel CLI** (Recommended)
   ```bash
   # Install Vercel CLI
   npm i -g vercel
   
   # Login to Vercel
   vercel login
   
   # Link to your project
   vercel link
   
   # Run database migration
   vercel env pull .env.production
   npm run prisma:deploy
   ```

2. **Via Local Development**
   ```bash
   # Set production DATABASE_URL in your local .env
   DATABASE_URL="your-production-postgresql-url"
   
   # Run migration
   npm run prisma:deploy
   
   # Optional: Seed with initial data
   npm run prisma:seed
   ```

## Step 4: Verify Deployment

1. **Check Application**
   - Visit your Vercel app URL
   - Register a new account
   - Create a group and test functionality

2. **Check Database**
   - Verify tables were created in your PostgreSQL database
   - Check that user registration works
   - Test expense creation and splitting

## Step 5: Set up Custom Domain (Optional)

1. In Vercel project settings, go to "Domains"
2. Add your custom domain
3. Update `NEXTAUTH_URL` environment variable to your custom domain
4. Redeploy the application

## Troubleshooting

### Common Issues

**Build Failures**
- Ensure all environment variables are set
- Check that `DATABASE_URL` is accessible from Vercel
- Verify Prisma schema is compatible with PostgreSQL

**Database Connection Issues**
- Verify database URL format: `postgresql://user:password@host:port/database`
- Check that your PostgreSQL provider allows external connections
- Ensure the database exists and is accessible

**Authentication Issues**
- Verify `NEXTAUTH_URL` matches your deployment URL
- Ensure `NEXTAUTH_SECRET` is at least 32 characters
- Check that the domain is correctly configured

### Getting Help

- Check Vercel deployment logs in the dashboard
- Review database connection from your PostgreSQL provider
- Check the application logs in Vercel Functions tab

## Maintenance

### Database Updates
```bash
# After schema changes, run:
npm run prisma:deploy
```

### Environment Updates
```bash
# Update environment variables in Vercel dashboard
# Then redeploy or wait for automatic deployment
```

## Security Notes

- Never commit actual environment variables to Git
- Use strong, unique passwords for your database
- Regularly rotate your `NEXTAUTH_SECRET`
- Monitor your application for suspicious activity

---

🎉 **Congratulations!** Your Expense Splitter application is now live in production!