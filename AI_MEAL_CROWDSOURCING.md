# AI Meal Crowdsourcing System

## Overview

This system allows AI-generated meal recommendations for unknown restaurants to be stored in the database and improved through user feedback. Users can report whether nutrition estimates are accurate, and the system learns from this feedback to provide better recommendations over time.

## How It Works

### 1. **Database Schema** (Prisma)

**AiGeneratedMeal Model:**
- Stores AI-generated meals for restaurants not in our pre-populated database
- Tracks nutrition data (calories, protein, carbs, fat)
- Includes metadata (source, reasoning, confidence score)
- Aggregates feedback statistics (average adjustments, feedback count)

**MealFeedback Model:**
- Stores individual user feedback on AI-generated meals
- Allows users to report accuracy or suggest corrections
- Types: `accurate`, `too_high`, `too_low`, `missing_item`

### 2. **API Flow**

**`/api/analyze-unknown-restaurant` (Enhanced):**
1. **Check Database First**: Look for existing AI-generated meals
2. **Return Cached Data**: If found, apply feedback adjustments and return
3. **Generate New**: If not found, use GPT-4o to analyze the restaurant
4. **Save to Database**: Store new recommendations for future use

**`/api/meal-feedback` (New):**
1. Accept user feedback on meal accuracy
2. Calculate average adjustments from all feedback
3. Update meal confidence score
4. Mark as `user_verified` after 5+ feedbacks with high confidence

### 3. **User Interface**

**AI Analysis Badge:**
- Shows on meals from unknown restaurants
- Displays source (estimated vs actual menu data)
- Shows feedback count if refined by users

**Feedback UI:**
- "Help Improve This" button on AI-generated meals
- Quick feedback options:
  - ✓ **Accurate** - Nutrition info is correct
  - 👎 **Too High** - Calories/macros overestimated
  - 👎 **Too Low** - Calories/macros underestimated
- Cancel button to close feedback panel

### 4. **Learning Algorithm**

**Confidence Score:**
- Starts at 0.5 for estimated nutrition
- Starts at 0.8 for actual menu data
- Increases with accurate feedback (+0.1 per accurate report)
- Increases slightly with any feedback (+0.02 per report)
- Max confidence: 0.95

**Nutrition Adjustments:**
- Calculates average difference between suggestions and original values
- Applied to all future requests
- Example: If 3 users say calories are 50 higher, system adds +50 to displayed calories

**Verification Status:**
- After 5+ feedbacks with confidence ≥ 0.8, source changes to `user_verified`
- These meals become as trusted as pre-populated data

## Benefits

1. **Faster Load Times**: Second visit to unknown restaurant returns cached data instantly
2. **Improved Accuracy**: Crowd-sourced corrections make estimates more accurate
3. **Community-Driven**: Users help build the database for everyone
4. **Scalability**: Can handle any restaurant without manual data entry
5. **Self-Improving**: System gets smarter with each piece of feedback

## Database Migration

To enable this feature, run:

```bash
npx prisma migrate dev --name add_ai_generated_meals_and_feedback
```

This creates the `ai_generated_meals` and `meal_feedback` tables.

## Example Workflow

### First Visit (No Data):
1. User selects "Joe's Pizza" (unknown restaurant)
2. System calls GPT-4o to analyze menu
3. Returns 3-5 meal recommendations
4. Saves to database for next time

### Subsequent Visits (Cached):
1. User selects "Joe's Pizza" again
2. System finds cached meals in database
3. Applies feedback adjustments from previous users
4. Returns instantly (no AI call needed)

### User Feedback:
1. User orders "Margherita Pizza"
2. Actual: 800 calories (AI estimated 650)
3. User clicks "Help Improve This" → "Too Low"
4. System updates average adjustment (+150 calories)
5. Next user sees corrected estimate (800 calories)

## Privacy & Trust

- Feedback is anonymous (only userId stored)
- Multiple feedback sources required for changes
- Extreme outliers are weighted less
- Original AI estimate always preserved
- Adjustments shown separately

## Future Enhancements

Potential additions:
- Allow users to upload menu photos
- OCR for automatic nutrition extraction
- User reputation system for weighted feedback
- Admin review for verified meals
- Export verified meals to main meal database
