# Clerk Migration Guide

## ✅ Completed Steps

1. ✅ Installed `@clerk/nextjs`
2. ✅ Created `src/middleware.ts` with `clerkMiddleware()`
3. ✅ Updated `src/app/layout.tsx` to use `<ClerkProvider>`
4. ✅ Updated `src/app/auth/signin/page.tsx` to use Clerk's `<SignIn />`
5. ✅ Created `src/app/auth/signup/page.tsx` with Clerk's `<SignUp />`
6. ✅ Updated `src/app/page.tsx` to use `useUser()` hook
7. ✅ Updated `src/app/dashboard/page.tsx` to use `useUser()` and `useClerk()`

---

## 🔧 Remaining Migration Steps

### Step 1: Update All Client Pages

Replace NextAuth imports and hooks with Clerk equivalents in these files:

#### Files to Update:
- `src/app/onboarding/page.tsx`
- `src/app/profile/page.tsx`
- `src/app/restaurant/[id]/page.tsx`
- `src/app/restaurants/page.tsx`
- `src/app/snacks/page.tsx`

#### Pattern to Follow:

**BEFORE (NextAuth):**
```typescript
import { useSession } from 'next-auth/react'

const { data: session, status } = useSession()

// Check loading
if (status === 'loading') return <div>Loading...</div>

// Check authentication
if (status === 'unauthenticated') {
  router.push('/auth/signin')
  return
}

// Access user ID
const userId = session?.user?.id
```

**AFTER (Clerk):**
```typescript
import { useUser } from '@clerk/nextjs'

const { user, isLoaded, isSignedIn } = useUser()

// Check loading
if (!isLoaded) return <div>Loading...</div>

// Check authentication
if (!isSignedIn) {
  router.push('/auth/signin')
  return
}

// Access user ID
const userId = user?.id
```

---

### Step 2: Update API Routes

All API routes that need authentication should use Clerk's `auth()` function.

#### Pattern for API Routes:

**BEFORE (Using userId from request body):**
```typescript
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ... use userId
}
```

**AFTER (Using Clerk auth):**
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

export async function GET(request: NextRequest) {
  const { userId } = await auth()

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ... use userId
}
```

#### API Routes That Need Updates:
- `src/app/api/macro-progress/route.ts`
- `src/app/api/profile/route.ts`
- `src/app/api/log-meal/route.ts`
- `src/app/api/daily-targets/route.ts`
- `src/app/api/reminders/route.ts`
- `src/app/api/food-catalog/route.ts`
- `src/app/api/contribute-restaurant-data/route.ts`

**NOTE:** The `/api/onboarding/route.ts` might still accept userId from body for initial setup, but verify authentication with Clerk.

---

### Step 3: Handle Clerk Webhooks for User Sync

Clerk doesn't automatically create users in your Prisma database. You need to sync users via webhooks.

#### Create Webhook Handler:

Create `src/app/api/webhooks/clerk/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { Webhook } from 'svix'
import { headers } from 'next/headers'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET

  if (!WEBHOOK_SECRET) {
    throw new Error('Please add CLERK_WEBHOOK_SECRET to .env.local')
  }

  // Get headers
  const headerPayload = await headers()
  const svix_id = headerPayload.get('svix-id')
  const svix_timestamp = headerPayload.get('svix-timestamp')
  const svix_signature = headerPayload.get('svix-signature')

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return NextResponse.json({ error: 'Missing headers' }, { status: 400 })
  }

  // Get body
  const payload = await req.json()
  const body = JSON.stringify(payload)

  // Verify webhook
  const wh = new Webhook(WEBHOOK_SECRET)
  let evt: any

  try {
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    })
  } catch (err) {
    console.error('Webhook verification failed:', err)
    return NextResponse.json({ error: 'Webhook verification failed' }, { status: 400 })
  }

  // Handle the event
  const eventType = evt.type

  if (eventType === 'user.created') {
    const { id, email_addresses, first_name, last_name, image_url } = evt.data

    try {
      await prisma.user.create({
        data: {
          id: id,
          email: email_addresses[0]?.email_address,
          name: `${first_name || ''} ${last_name || ''}`.trim() || null,
          image: image_url || null,
          emailVerified: email_addresses[0]?.verification?.status === 'verified' ? new Date() : null,
        },
      })

      console.log('✅ User created in database:', id)
    } catch (error) {
      console.error('Error creating user:', error)
      return NextResponse.json({ error: 'Failed to create user' }, { status: 500 })
    }
  }

  if (eventType === 'user.updated') {
    const { id, email_addresses, first_name, last_name, image_url } = evt.data

    try {
      await prisma.user.update({
        where: { id },
        data: {
          email: email_addresses[0]?.email_address,
          name: `${first_name || ''} ${last_name || ''}`.trim() || null,
          image: image_url || null,
        },
      })

      console.log('✅ User updated in database:', id)
    } catch (error) {
      console.error('Error updating user:', error)
    }
  }

  if (eventType === 'user.deleted') {
    const { id } = evt.data

    try {
      await prisma.user.delete({
        where: { id },
      })

      console.log('✅ User deleted from database:', id)
    } catch (error) {
      console.error('Error deleting user:', error)
    }
  }

  return NextResponse.json({ message: 'Webhook processed' }, { status: 200 })
}
```

#### Install Svix for Webhook Verification:
```bash
npm install svix
```

#### Configure Webhook in Clerk Dashboard:
1. Go to https://dashboard.clerk.com
2. Select your application
3. Go to "Webhooks" in the sidebar
4. Click "Add Endpoint"
5. Enter: `https://your-domain.com/api/webhooks/clerk`
6. Subscribe to events: `user.created`, `user.updated`, `user.deleted`
7. Copy the webhook secret and add to `.env.local` as `CLERK_WEBHOOK_SECRET`

---

### Step 4: Update Database Schema

The current schema has NextAuth-specific tables that can be removed with Clerk.

#### Tables to REMOVE from `prisma/schema.prisma`:

```prisma
// ❌ Remove these models - Clerk handles authentication
model Account { ... }
model Session { ... }
model VerificationToken { ... }
```

#### Update User Model:

```prisma
model User {
  id            String    @id // Clerk will provide this
  createdAt     DateTime  @default(now())
  name          String?
  email         String?   @unique
  emailVerified DateTime?
  image         String?

  profile      Profile?
  preferences  Preferences?
  dailyTargets DailyTarget[]
  mealLogs     MealLog[]
  reminders    Reminder[]
  restaurantContributions RestaurantContribution[]

  @@map("users")
}
```

#### Remove Prisma Adapter Relations:

In `User` model, remove:
```prisma
accounts     Account[]  // ❌ Remove
sessions     Session[]  // ❌ Remove
```

Then run:
```bash
npm run db:push
```

---

### Step 5: Environment Variables

Update `.env.local` with Clerk credentials:

```bash
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Clerk Webhooks
CLERK_WEBHOOK_SECRET=whsec_...

# Clerk URLs (Optional - these are defaults)
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/auth/signin
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/auth/signup
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/onboarding
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/onboarding

# Remove these NextAuth variables:
# ❌ GOOGLE_CLIENT_ID
# ❌ GOOGLE_CLIENT_SECRET
# ❌ NEXTAUTH_URL
# ❌ NEXTAUTH_SECRET
```

**Get Clerk Keys:**
1. Go to https://dashboard.clerk.com
2. Select/Create your application
3. Go to "API Keys"
4. Copy the publishable key and secret key

---

### Step 6: Remove NextAuth Files and Dependencies

#### Delete Files:
```bash
rm -rf src/app/api/auth
rm src/components/NextAuthProvider.tsx
rm src/types/next-auth.d.ts
```

#### Remove Dependencies:
```bash
npm uninstall next-auth @auth/prisma-adapter
```

---

### Step 7: Test Authentication Flow

1. **Start dev server:** `npm run dev`
2. **Visit:** `http://localhost:3000`
3. **Expected flow:**
   - Redirects to `/auth/signin`
   - Sign up creates user in Clerk
   - Webhook creates user in your database
   - After sign-in, redirects to `/onboarding`
   - User can access protected pages

---

## 🎨 Optional: Customize Clerk Appearance

You can customize Clerk components to match your app's design:

```typescript
// In layout.tsx or individual auth pages
<ClerkProvider
  appearance={{
    baseTheme: dark, // Import from @clerk/themes
    variables: {
      colorPrimary: '#6366f1', // Indigo-500
      colorBackground: '#000000',
      colorInputBackground: '#1f2937',
      colorInputText: '#ffffff',
    },
    elements: {
      card: 'bg-gray-900/50 backdrop-blur-xl border border-gray-800/50',
      headerTitle: 'text-white',
      headerSubtitle: 'text-gray-400',
      socialButtonsBlockButton: 'bg-gray-800 hover:bg-gray-700 border-gray-700',
      formButtonPrimary: 'bg-blue-600 hover:bg-blue-700',
    }
  }}
>
```

---

## 📋 Migration Checklist

- [ ] Update all client pages to use `useUser()` instead of `useSession()`
- [ ] Update all API routes to use `auth()` from `@clerk/nextjs/server`
- [ ] Create webhook handler at `/api/webhooks/clerk/route.ts`
- [ ] Install `svix` for webhook verification
- [ ] Update Prisma schema (remove NextAuth models)
- [ ] Run `npm run db:push`
- [ ] Configure webhook in Clerk Dashboard
- [ ] Update `.env.local` with Clerk keys
- [ ] Remove NextAuth files and dependencies
- [ ] Test complete authentication flow
- [ ] Test all protected pages
- [ ] Test all API routes

---

## 🐛 Common Issues

### Issue: "User not found in database"
**Solution:** Make sure webhook is configured and user sync is working.

### Issue: "Cannot read properties of null"
**Solution:** Always check `isLoaded` before accessing `user` object.

### Issue: Infinite redirect loop
**Solution:** Check middleware matcher config - it should not match sign-in/sign-up routes.

### Issue: API routes return 401
**Solution:** Ensure you're using `await auth()` and checking `userId` exists.

---

## 📚 Resources

- [Clerk Next.js Quickstart](https://clerk.com/docs/nextjs/getting-started/quickstart)
- [Clerk Webhooks Guide](https://clerk.com/docs/integrations/webhooks)
- [Clerk Customization](https://clerk.com/docs/components/customization/overview)
