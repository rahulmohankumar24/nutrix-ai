# Environment Variables Setup

## Files Structure

### `.env` (Database Only)
- **Purpose**: Used by Prisma for database connections
- **Contains**: Only `DATABASE_URL` and `DIRECT_URL`
- **Git**: Ignored (contains credentials)
- **Used by**: Prisma CLI, migrations, database operations

### `.env.local` (All App Secrets)
- **Purpose**: Local development environment variables
- **Contains**:
  - Clerk authentication keys
  - Supabase keys and URLs
  - OpenAI API key
  - Google OAuth credentials
  - All other secrets
- **Git**: Ignored (contains secrets)
- **Used by**: Next.js app during development

### `.env.example` (Template)
- **Purpose**: Documentation and template for new developers
- **Contains**: Placeholder values showing what variables are needed
- **Git**: Tracked (no secrets)
- **Used by**: New team members setting up their environment

## Why This Structure?

**Prisma Reads `.env`:**
- Prisma CLI automatically looks for `.env` file
- We keep database credentials here for Prisma operations

**Next.js Reads `.env.local` (Highest Priority):**
- Next.js prioritizes `.env.local` over `.env`
- All app runtime variables go here
- Prevents conflicts with Prisma-specific vars

**Production:**
- Set all environment variables in Vercel dashboard
- Never commit `.env` or `.env.local` to git

## Git Protection

Your `.gitignore` includes:
```
.env*
.env*.local
```

This ignores all `.env` files EXCEPT `.env.example`.

## Quick Commands

**Validate Prisma:**
```bash
npx prisma validate
```

**Run Migrations:**
```bash
npx prisma migrate dev
```

**Generate Prisma Client:**
```bash
npx prisma generate
```

**Start Dev Server:**
```bash
npm run dev
```

All commands will automatically use the correct environment variables!

## Adding New Variables

1. **Database-related**: Add to `.env`
2. **App secrets/keys**: Add to `.env.local`
3. **Production**: Add to Vercel dashboard
4. **Template**: Update `.env.example` with placeholder

## Current Variables

### Database (`.env`)
- `DATABASE_URL` - Supabase connection (pooled)
- `DIRECT_URL` - Supabase connection (direct)

### Application (`.env.local`)
- Clerk (auth)
- Supabase (database, storage)
- OpenAI (AI features)
- Google OAuth
- Vercel tokens

All set! 🚀
