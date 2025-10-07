#!/usr/bin/env node

/**
 * Database Deployment Script for Production
 * 
 * This script handles database migrations for production deployment.
 * Run this after setting up your production PostgreSQL database.
 */

const { execSync } = require('child_process');

async function deployDatabase() {
  console.log('🚀 Starting database deployment...');

  try {
    // Generate Prisma Client
    console.log('📦 Generating Prisma Client...');
    execSync('npm run prisma:generate', { stdio: 'inherit' });

    // Run database migrations
    console.log('🔄 Running database migrations...');
    execSync('npx prisma migrate deploy', { stdio: 'inherit' });

    // Optional: Seed database with initial data
    console.log('🌱 Seeding database (optional)...');
    try {
      execSync('npm run prisma:seed', { stdio: 'inherit' });
      console.log('✅ Database seeded successfully');
    } catch (error) {
      console.log('⚠️  Database seeding skipped (seed script not found or failed)');
    }

    console.log('✅ Database deployment completed successfully!');
    console.log('🎉 Your production database is ready to use.');

  } catch (error) {
    console.error('❌ Database deployment failed:', error.message);
    process.exit(1);
  }
}

// Run deployment
deployDatabase();