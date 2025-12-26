# Rovia - Personalized Nutrition Coach MVP

A full-stack nutrition coaching app that calculates personalized daily targets, finds nearby restaurants, and recommends specific meals to hit your macros.

## 🎯 Core Features

- **Onboarding Flow**: Collects user info + goals, calculates daily macro targets deterministically
- **Smart Dashboard**: Shows remaining macros + nearby restaurants with location-based recommendations
- **Restaurant Integration**: Uses OpenStreetMap to find nearby restaurants, prioritizes macro-known chains
- **Meal Recommendations**: Suggests specific orders at known restaurants (Chipotle, Cava, etc.) to fit remaining macros
- **Nutrition Database**: 40+ restaurant order templates + 25+ home/grocery food items
- **Reminder System**: Customizable nutrition checkpoints throughout the day

## 🚀 Quick Start

### Prerequisites
- Node.js 20.19+ (for Prisma compatibility)
- Supabase account (for PostgreSQL database)
- OpenAI API key (optional, for preference parsing)

### 1. Setup Database (Supabase)

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to Settings > Database and copy your connection string
3. Update your `.env.local`:

```bash
# Copy .env to .env.local and update these values
DATABASE_URL="postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres"
OPENAI_API_KEY="sk-..." # Optional
```

### 2. Install & Setup

```bash
# Install dependencies
npm install

# Push database schema to Supabase
npm run db:push

# Seed with restaurant templates + food items
npm run db:seed

# Start development server
npm run dev
```

Visit `http://localhost:3000` and complete onboarding!

### 3. Deploy to Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy (connects to Supabase automatically)
vercel --prod
```

## 📱 App Flow

### 1. Onboarding (`/onboarding`)
- Basic info: sex, age, height, weight, activity level
- Goals: cut/recomp/lean_bulk
- Dietary constraints & preferences
- Free-text description → OpenAI extracts structured preferences

### 2. Dashboard (`/dashboard`)
- **Today's Macros**: Current vs remaining calories/protein/carbs/fat
- **Best Orders Right Now**: Top 6 meal recommendations from nearby restaurants
- **Restaurants Nearby**:
  - ✅ Macro-known chains (recommended)
  - ❓ Other restaurants (macros unknown)

### 3. Meals (`/meals`)
- Browse all restaurant order templates
- Home/grocery food catalog
- Filter by tags (high-protein, low-carb, etc.)

### 4. Reminders (`/reminders`)
- Customize daily nutrition checkpoints
- View next upcoming reminder
- Toggle on/off individual reminders

## 🧮 Target Calculation (Deterministic)

Uses **Mifflin-St Jeor equation** + activity multipliers:

```
BMR = 10×kg + 6.25×cm - 5×age + (5 for male, -161 for female)
TDEE = BMR × activity_multiplier
Goal calories = TDEE ± goal_adjustment

Protein: 0.95-1.1g/lb (varies by goal)
Fat: 0.35g/lb (clamped 0.3-0.45g/lb)
Carbs: Fill remaining calories
```

**Goal adjustments:**
- Cut: -300 calories
- Recomp: +100 calories
- Lean Bulk: +250 calories

## 🍽️ Restaurant Integration

### Location & Discovery
- Uses browser geolocation API
- Queries **Overpass API** (OpenStreetMap) for restaurants within 2km
- No API keys required!

### Known Chains (Macro Data Available)
- Chipotle, Cava, Sweetgreen, Subway, Panera, Starbucks
- Panda Express, Chick-fil-A, Five Guys, In-N-Out

### Recommendation Engine
1. Calculate "next meal target" (35% of remaining macros)
2. Score all order templates by macro fit
3. Lower score = better fit
4. Provide "Order Now" deep-links to DoorDash/UberEats

## 🗄️ Database Schema

### Core Models
- **User**: Basic user record
- **Profile**: Demographics, goals, activity level
- **Preferences**: AI-extracted eating patterns from free-text
- **DailyTarget**: Calculated macro targets for each day
- **Reminder**: Customizable nutrition checkpoints

### Food Data
- **FoodCatalogItem**: Home/grocery foods (25+ items)
- **OrderTemplate**: Restaurant meal templates (40+ items)
- **MealLog**: User's logged meals (for tracking progress)

## 🔧 Tech Stack

- **Frontend**: Next.js 14 + TypeScript + Tailwind CSS
- **Backend**: Next.js API routes + Prisma ORM
- **Database**: PostgreSQL (Supabase)
- **AI**: OpenAI GPT-4o-mini (structured JSON parsing only)
- **Location**: Browser Geolocation + Overpass API
- **Deployment**: Vercel + Supabase

## 📄 API Endpoints

- `POST /api/onboarding` - Create user profile + calculate targets
- `POST /api/parse-preferences` - OpenAI preference extraction
- `GET /api/nearby` - Find restaurants via Overpass API
- `POST /api/recommendations` - Generate meal recommendations
- `GET /api/macro-progress` - Today's macro progress
- `GET /api/meals` - Browse food catalog + templates
- `GET /api/reminders` - User's reminder schedule

## 🚧 MVP Limitations

- **No Authentication**: Uses localStorage for user session
- **Single User**: No multi-user support
- **No Push Notifications**: Reminders stored in DB only
- **No Meal Logging**: UI stubs present, tracking not implemented
- **No Payment Integration**: Deep-links to delivery apps only
- **Basic Error Handling**: Network errors may not be gracefully handled

## 🎯 Next Steps for V2

1. **Auth System**: Implement proper authentication
2. **Meal Logging**: Full tracking with progress charts
3. **Push Notifications**: Real reminder system
4. **Payment Integration**: Direct ordering through delivery APIs
5. **Social Features**: Share progress, meal photos
6. **Advanced AI**: Menu scraping for more restaurants
7. **Nutrition Coaching**: Adaptive recommendations based on progress

## 🤝 Contributing

This is an MVP built for demonstration. For production use:

1. Add comprehensive error boundaries
2. Implement proper loading states
3. Add extensive input validation
4. Set up monitoring & analytics
5. Add comprehensive test coverage

## 📜 License

MIT License - feel free to use this as a starting point for your nutrition app!

---

**Built with ❤️ using Next.js, Prisma, and OpenAI**
