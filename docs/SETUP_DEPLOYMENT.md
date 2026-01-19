# ServiceOps AI - Setup & Deployment Guide

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL database (via Supabase)
- Git
- Vercel account (for deployment)

## Local Development Setup

### 1. Clone Repository
```bash
git clone [your-repo-url]
cd Serviceops-ai
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Variables

Create `.env.local` file in root:

```env
# Database
DATABASE_URL="postgresql://[user]:[password]@[host]:[port]/[database]?schema=public"

# Supabase
NEXT_PUBLIC_SUPABASE_URL="https://[project-id].supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="[your-anon-key]"

# Optional
NODE_ENV="development"
```

**Getting Supabase Credentials:**
1. Go to Supabase Dashboard → Project Settings
2. API section for URL and anon key
3. Database section for connection string

### 4. Database Setup

```bash
# Generate Prisma Client
npx prisma generate

# Push schema to database
npx prisma db push

# OR run migrations (if using migration files)
npx prisma migrate dev
```

**Windows PowerShell Note:**
```powershell
# Set environment variable temporarily
$env:DATABASE_URL="postgresql://..."
```

### 5. Run Development Server

```bash
npm run dev
```

Visit `http://localhost:3000`

### 6. Prisma Studio (Optional)

View/edit database in browser:
```bash
npx prisma studio
```

## Database Management

### Creating Migrations

**Recommended: Using db push (handles drift)**
```bash
npx prisma db push
```

**Alternative: Formal migrations**
```bash
npx prisma migrate dev --name descriptive_name
```

### Resetting Database

**⚠️ WARNING: Destroys all data**
```bash
npx prisma migrate reset
```

### Seed Data (if available)
```bash
npx prisma db seed
```

## Deployment to Vercel

### Initial Setup

1. **Connect Repository:**
   - Go to Vercel Dashboard
   - "Add New Project"
   - Import from Git
   - Select repository

2. **Configure Environment Variables:**
   Add all variables from `.env.local`:
   - `DATABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

3. **Build Settings:**
   - Framework Preset: Next.js
   - Build Command: `npm run build`
   - Output Directory: `.next`
   - Install Command: `npm install`

4. **Deploy:**
   Click "Deploy" - first build will take 2-3 minutes

### Automatic Deployments

**Production:**
- Push to `main` branch → Auto-deploys to production

**Preview:**
- Push to any branch → Creates preview deployment
- Pull requests get preview URLs

### Environment-Specific Databases

**Recommended Setup:**
- **Local**: Local Supabase or dedicated dev database
- **Staging**: Separate Supabase project
- **Production**: Production Supabase project

**Managing Multiple Environments:**
```bash
# Local development
DATABASE_URL="postgresql://localhost:5432/serviceops_dev"

# Staging (in Vercel)
DATABASE_URL="postgresql://staging.supabase.co/..."

# Production (in Vercel)
DATABASE_URL="postgresql://production.supabase.co/..."
```

### Deployment Checklist

Before deploying to production:

- [ ] All environment variables set in Vercel
- [ ] Database migrations applied
- [ ] Supabase RLS policies configured (if using)
- [ ] Custom domain configured (if applicable)
- [ ] Error tracking enabled (optional: Sentry)
- [ ] Analytics enabled (optional: Vercel Analytics)

### Build Troubleshooting

**Common Build Errors:**

1. **"Cannot find module '@prisma/client'"**
   - Solution: Ensure `prisma generate` runs in build command
   - Build command should be: `prisma generate && next build`

2. **"Field doesn't exist on type"**
   - Solution: Check Prisma schema matches code
   - Field names must be exact

3. **"Enum type mismatch"**
   - Solution: Use exact enum values from schema

4. **Database connection fails**
   - Solution: Check DATABASE_URL format
   - Ensure IP whitelisting (if required by database)

## Vercel Configuration

### vercel.json (optional)
```json
{
  "buildCommand": "prisma generate && next build",
  "framework": "nextjs",
  "installCommand": "npm install"
}
```

### Custom Domains

1. **Add Domain in Vercel:**
   - Project Settings → Domains
   - Add domain name
   - Follow DNS configuration instructions

2. **SSL Certificates:**
   - Automatic via Let's Encrypt
   - Enabled by default

## Database Backup

**Supabase Backups:**
- Automatic daily backups (Pro plan)
- Point-in-time recovery available

**Manual Backup:**
```bash
# Export database
pg_dump [DATABASE_URL] > backup.sql

# Restore database
psql [DATABASE_URL] < backup.sql
```

## Monitoring

### Vercel Dashboard
- Deployment logs
- Runtime logs
- Performance metrics
- Error tracking

### Database Monitoring
- Supabase Dashboard → Database → Query Performance
- Monitor slow queries
- Check connection pooling

## Scaling Considerations

### Database
- Supabase Pro: Better connection pooling
- Consider read replicas for high traffic
- Enable connection pooling in Prisma

### Vercel
- Automatic scaling on Pro plan
- Edge caching for static assets
- Serverless functions scale automatically

## Security Best Practices

### Environment Variables
- Never commit `.env` files
- Use Vercel's encrypted storage
- Rotate secrets periodically

### Database
- Use connection pooling
- Enable SSL connections
- Regular security updates

### Application
- Keep dependencies updated
- Enable CORS properly
- Validate all user input

## Maintenance

### Regular Tasks
- Monitor database size and performance
- Review and optimize slow queries
- Update dependencies monthly
- Check Vercel logs for errors

### Updates

**Updating Dependencies:**
```bash
# Check for updates
npm outdated

# Update all dependencies
npm update

# Update specific package
npm update [package-name]
```

**Updating Prisma:**
```bash
npm update @prisma/client prisma
npx prisma generate
```

## CI/CD Pipeline (Optional)

### GitHub Actions Example
```yaml
name: Deploy to Vercel
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm ci
      - run: npx prisma generate
      - run: npm run build
      - uses: amondnet/vercel-action@v20
```

## Rollback Procedure

### Vercel
1. Go to Project → Deployments
2. Find previous successful deployment
3. Click "..." → Promote to Production

### Database
1. Use Supabase backup restore
2. Or restore from manual backup
3. May need to revert schema changes

## Support Resources

- **Vercel Docs:** https://vercel.com/docs
- **Prisma Docs:** https://www.prisma.io/docs
- **Supabase Docs:** https://supabase.com/docs
- **Next.js Docs:** https://nextjs.org/docs

## Troubleshooting Common Issues

### Issue: Build succeeds but runtime errors
**Solution:** Check environment variables are set in Vercel

### Issue: Database connection timeout
**Solution:** 
- Check DATABASE_URL format
- Verify database is accessible
- Check connection pooling settings

### Issue: Slow API responses
**Solution:**
- Review database query performance
- Add missing indexes
- Optimize N+1 queries

### Issue: Memory issues in Vercel
**Solution:**
- Optimize large queries
- Implement pagination
- Consider serverless function size limits

## Development Workflow

**Recommended Flow:**
1. Create feature branch from `main`
2. Develop and test locally
3. Push to GitHub
4. Review preview deployment
5. Merge to `main` when ready
6. Automatic production deployment
7. Monitor logs and metrics

## Production Checklist

Before going live:

- [ ] All features tested thoroughly
- [ ] Database properly indexed
- [ ] Error handling implemented
- [ ] Loading states on all async operations
- [ ] Mobile responsive design verified
- [ ] Security audit completed
- [ ] Backup strategy in place
- [ ] Monitoring and alerts configured
- [ ] Documentation updated
- [ ] User training materials ready

## Post-Deployment

### First 24 Hours
- Monitor error logs closely
- Watch database performance
- Check API response times
- Verify all integrations working

### First Week
- Gather user feedback
- Monitor usage patterns
- Optimize based on real-world data
- Plan iterative improvements
