# Restaurant Meal Generation - Implementation Guide

## Overview

The restaurant meal generation system automatically provides personalized meal recommendations when users click on a restaurant. The system intelligently matches restaurant names from OpenStreetMap with meal data in the database.

## How It Works

### 1. Restaurant Name Normalization

**Problem Solved:** OpenStreetMap returns restaurant names like "Chipotle Mexican Grill" but the database stores them as "chipotle".

**Solution:** Created `src/lib/restaurant-matcher.ts` with:
- **`normalizeRestaurantName()`**: Converts various restaurant name formats to canonical database names
- **`hasKnownMealData()`**: Checks if a restaurant has meal data
- **`getDisplayName()`**: Returns user-friendly display names
- **Brand mappings for 25+ restaurant chains** including:
  - National chains (Chipotle, Sweetgreen, Panera, Subway)
  - California-specific (In-N-Out, Flame Broiler, Tender Greens)
  - NYC-specific (Just Salad, Chopt, Dig, Pret A Manger)
  - Seattle-specific (Dick's Drive-In, Ivar's, MOD Pizza, Pagliacci)

### 2. API Integration

Updated three key API endpoints to use name normalization:

#### `/api/ai-unified-meal-coach`
- **Purpose**: Analyzes meals from fixed-menu restaurants using AI
- **Enhancement**: Now normalizes restaurant names before database lookup
- **Features**:
  - Pre-filters meals algorithmically for efficiency
  - AI analyzes top 8 candidates
  - Provides coaching with customization suggestions
  - Caches results for 2 hours

#### `/api/restaurant-meals`
- **Purpose**: Fetches available meals for a restaurant
- **Enhancement**: Normalizes names and scores meals based on user targets
- **Features**:
  - Returns top 10 meals sorted by nutrition fit score
  - Time-of-day aware scoring
  - Penalizes meals that would overconsume remaining calories

#### `/api/ai-meal-builder`
- **Purpose**: Builds custom meals for customizable restaurants (Chipotle, Cava, etc.)
- **Features**:
  - Uses realistic meal distribution (doesn't try to fit all daily calories in one meal)
  - Categorizes ingredients (protein, base, vegetables, sauces, toppings)
  - Generates 3 meal options with build instructions

### 3. Frontend Flow

When a user clicks a restaurant on `/restaurants` page:

1. **Navigation**: User clicks restaurant → navigates to `/restaurant/[id]/page.tsx`
2. **Data Loading**: Page loads restaurant info and user's macro progress
3. **Auto-Generation**: Automatically triggers AI insights via `generateAIInsights()`
4. **Restaurant Type Detection**:
   - **Customizable** (Chipotle, Cava, Subway): → `/api/ai-meal-builder`
   - **Known chain with data**: → `/api/ai-unified-meal-coach`
   - **Unknown restaurant**: → `/api/estimate-restaurant`

### 4. Meal Display

The frontend shows:
- **AI Coach Recommendations** with personalized advice
- **Meal cards** sorted by macro fit score
- **Macro breakdown** (calories, protein, carbs, fat)
- **Customization suggestions** (e.g., "Add double protein")
- **Action buttons**: "Add to Log" and "Order Now"

## Database Structure

### OrderTemplate Table
```prisma
model OrderTemplate {
  id                        String @id
  restaurantBrand           String  // Canonical name (e.g., "chipotle")
  title                     String
  description               String
  calories                  Int
  protein                   Int
  carbs                     Int
  fat                       Int
  tags                      String  // JSON array
  keywordsForDeliverySearch String
}
```

### Seeded Data
The database includes **70+ meals** from 25+ restaurant chains:
- **8 Chipotle meals** (bowls, salads, burritos)
- **8 Sweetgreen meals** (harvest bowl, guacamole greens)
- **6 Cava meals** (Mediterranean bowls)
- **5 Panera meals** (bowls and salads)
- **Multiple entries per chain** for variety

## Testing the Feature

### Prerequisites
1. Database must be seeded with meal data:
   ```bash
   npm run seed
   # or manually: npx tsx prisma/seed.ts
   ```

2. Environment variables required:
   ```env
   OPENAI_API_KEY=sk-...
   DATABASE_URL=postgresql://...
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
   CLERK_SECRET_KEY=sk_...
   ```

### Test Flow
1. Start the app: `npm run dev`
2. Sign in with Clerk authentication
3. Complete onboarding to set macro targets
4. Navigate to `/restaurants` page
5. Allow location access (or enter coordinates manually)
6. Click on any known restaurant (e.g., Chipotle, Sweetgreen)
7. **Expected Result**: Meals should auto-generate within 3-5 seconds

### Debugging
If meals don't appear, check:
1. **Console logs**: Look for "🏪 Restaurant name normalized" messages
2. **Network tab**: Check API calls to `/api/ai-unified-meal-coach` or `/api/restaurant-meals`
3. **Database**: Verify meals exist for the restaurant brand
4. **OpenAI API**: Ensure API key is valid and has credits

## Adding New Restaurants

### Method 1: Add to Seed File
1. Edit `prisma/seed.ts`
2. Add new OrderTemplate entries with canonical brand name
3. Run: `npx tsx prisma/seed.ts`

### Method 2: Add Brand Mapping
1. Edit `src/lib/restaurant-matcher.ts`
2. Add to `BRAND_MAPPINGS` array:
```typescript
{
  canonical: 'restaurant-name',
  patterns: ['Restaurant Name', 'Restaurant']
}
```

## Performance Optimizations

1. **Caching**: AI results cached for 2 hours per user/restaurant/time combination
2. **Pre-filtering**: Algorithms score all meals before AI analysis
3. **Batch processing**: AI analyzes only top 8-10 candidates
4. **Fast model**: Uses GPT-4o-mini for quick responses
5. **Token limits**: Constrained prompts and responses for speed

## Known Limitations

1. **OpenStreetMap coverage**: Not all restaurants have accurate OSM data
2. **Name variations**: Some local chains may not match database names
3. **Menu changes**: Static meal database doesn't reflect real-time menu updates
4. **Nutrition accuracy**: Data is approximated, may not match actual restaurant values
5. **Regional availability**: Some chains only available in certain locations

## Future Enhancements

- [ ] Real-time menu scraping from restaurant websites
- [ ] User-contributed meal data with verification system
- [ ] Photo-based nutrition estimation using vision AI
- [ ] Integration with delivery app APIs (DoorDash, Uber Eats)
- [ ] Seasonal menu item detection
- [ ] Allergen and dietary restriction filtering

## API Response Examples

### Successful Response
```json
{
  "success": true,
  "meals": [
    {
      "id": "meal_123",
      "title": "Double Chicken Bowl",
      "description": "High-protein bowl...",
      "calories": 830,
      "protein": 71,
      "carbs": 65,
      "fat": 32,
      "aiScore": 95,
      "aiReasoning": "Perfect protein hit for dinner",
      "customizations": ["Add extra guacamole for healthy fats"],
      "macroImpact": "Fits 850cal meal target perfectly"
    }
  ],
  "coaching": {
    "overallAdvice": "Great choices for dinner...",
    "restaurantTips": "Double protein is excellent value..."
  },
  "aiEnhanced": true
}
```

### Error Response
```json
{
  "error": "No meals found for this restaurant",
  "status": 404
}
```

## Troubleshooting

### "No meals found for this restaurant"
- **Cause**: Restaurant name doesn't match any in database
- **Solution**: Add brand mapping in `restaurant-matcher.ts`

### "AI analysis failed"
- **Cause**: OpenAI API error or invalid response format
- **Solution**: Check API key, credits, and response parsing

### Meals not loading
- **Cause**: Frontend not calling API or user not authenticated
- **Solution**: Check browser console for errors, verify auth state

### Wrong restaurant matched
- **Cause**: Overly broad pattern matching
- **Solution**: Make patterns more specific in brand mappings

## Support

For issues or questions:
1. Check console logs for error messages
2. Verify environment variables are set
3. Review Network tab for failed API calls
4. Ensure database is seeded with meal data
5. Confirm OpenAI API key is valid

---

**Last Updated**: December 26, 2025
**Version**: 1.0.0
