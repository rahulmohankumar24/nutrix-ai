# Rovia AI Personalization Roadmap

## Current State Analysis

### What You Have ✅
- **Basic Demographics**: Age, sex, height, weight
- **Fitness Goals**: Goal type (cut/recomp/bulk), lifting days, steps level
- **Dietary Info**: Constraints, dislikes, preferred cuisines
- **Timing**: Wake time, lunch time, dinner time
- **Preferences**: Eating pattern, time to cook, budget
- **Meal History**: MealLog tracks what users eat

### What's Missing for Deep Personalization ⚠️

---

## Priority 1: Behavioral Feedback Loops (CRITICAL)

The AI needs to learn from actual user behavior, not just stated preferences.

### 1.1 Meal Feedback System
**Schema Addition:**
```prisma
model MealFeedback {
  id            String   @id @default(cuid())
  userId        String
  mealLogId     String   @unique

  // Ratings (1-5 scale)
  tasteRating      Int?     // How much did you like it?
  satietyRating    Int?     // How full did it make you?
  energyRating     Int?     // Energy level 2 hours after

  // Binary feedback
  wouldOrderAgain  Boolean?
  hitMacroGoals    Boolean?

  // Context
  hungerBefore     Int?     // 1-5 scale
  stressLevel      Int?     // 1-5 scale

  // Free text
  notes            String?

  createdAt     DateTime @default(now())

  user    User     @relation(fields: [userId], references: [id])
  mealLog MealLog  @relation(fields: [mealLogId], references: [id])
}
```

**Why This Matters:**
- AI learns which meals the user actually enjoys
- Can predict satisfaction before ordering
- Discovers hidden preferences (e.g., "user rates spicy food 5/5 despite saying they dislike it")
- Adapts recommendations based on satiety patterns

**Implementation:**
- Prompt users 2 hours after logging a meal
- Make it quick (3 taps: taste, fullness, energy)
- Use this data in AI prompts: "User rated similar bowls 4.5/5 on average"

---

### 1.2 Choice Pattern Learning
**Schema Addition:**
```prisma
model UserBehaviorPattern {
  id                String   @id @default(cuid())
  userId            String

  // Learned preferences
  preferredProteinSources    String @default("[]") // ["chicken", "tofu"]
  avoidedIngredients         String @default("[]") // Actually avoided vs stated
  favoriteRestaurants        String @default("[]")

  // Behavioral insights (AI-generated)
  typicalBreakfastCalories   Int?
  weekdayVsWeekendPattern    String? // "eats out more on weekends"
  adherenceScore             Float?  // 0-100

  // Timing patterns
  preferredMealTimesActual   String? // JSON of actual eating times

  lastUpdated DateTime @default(now())

  user User @relation(fields: [userId], references: [id])

  @@unique([userId])
}
```

**Why This Matters:**
- Actions speak louder than words
- User says "I don't like cheese" but orders extra cheese 80% of the time → AI learns the truth
- Discovers patterns: "User always chooses protein-heavy options for lunch on lifting days"

---

## Priority 2: Progress Tracking & Adaptive Coaching

### 2.1 Body Metrics History
**Schema Addition:**
```prisma
model BodyMetric {
  id          String   @id @default(cuid())
  userId      String
  date        DateTime

  // Measurements
  weightLb         Float
  bodyFatPercent   Float?
  waistInches      Float?

  // Subjective
  energyLevel      Int?   // 1-10 scale
  sleepQuality     Int?   // 1-10 scale
  stressLevel      Int?   // 1-10 scale
  hungerLevel      Int?   // 1-10 scale
  mood             Int?   // 1-10 scale

  // Performance
  liftingPR        String? // JSON of lift PRs

  notes       String?
  photoUrl    String?

  user User @relation(fields: [userId], references: [id])

  @@index([userId, date])
}
```

**Why This Matters:**
- AI can correlate meals with outcomes: "When you eat 180g+ protein, you report higher energy"
- Adaptive recommendations: "Your weight is trending down faster than target, let's increase calories by 100"
- Personalized macro adjustments based on results, not just formulas

**Implementation:**
- Weekly check-in prompts
- Photo upload for visual progress
- AI analyzes trends and adjusts targets

---

### 2.2 Adherence Tracking
**Schema Addition:**
```prisma
model DailyAdherence {
  id            String   @id @default(cuid())
  userId        String
  date          DateTime

  // Macro adherence (as % of target)
  calorieAdherence   Float
  proteinAdherence   Float
  carbsAdherence     Float
  fatAdherence       Float

  // Context
  dayType           String  // weekday, weekend, travel, special_event
  adherenceScore    Float   // 0-100 weighted score

  // Flags
  bingEpisode       Boolean @default(false)
  skippedMeals      Int     @default(0)

  user User @relation(fields: [userId], references: [id])

  @@unique([userId, date])
  @@index([userId, date])
}
```

**Why This Matters:**
- Identify struggle patterns: "User misses protein targets on weekends"
- Proactive coaching: "It's Friday - here are high-protein quick options"
- Celebrate wins: "You hit protein target 6 days this week! 🎉"

---

## Priority 3: Contextual Awareness

### 3.1 Real-Time Context
**Schema Addition:**
```prisma
model DailyContext {
  id              String   @id @default(cuid())
  userId          String
  date            DateTime

  // Life context
  workoutCompleted   Boolean  @default(false)
  workoutIntensity   String?  // light, moderate, intense
  sleepHours         Float?
  stepsCount         Int?
  waterIntake        Float?   // in oz

  // Emotional/social
  stressLevel        Int?     // 1-10
  socialEating       Boolean  @default(false) // eating with others
  specialEvent       String?  // date_night, business_lunch, celebration

  // Environmental
  traveling          Boolean  @default(false)
  limitedOptions     Boolean  @default(false)

  user User @relation(fields: [userId], references: [id])

  @@unique([userId, date])
}
```

**Why This Matters:**
- AI adjusts for context: "High-stress day + low sleep = recommend comfort foods within macros"
- Post-workout meal timing: "You just logged a workout, here's a protein-focused meal"
- Social awareness: "Date night? Here are restaurant meals that fit macros but don't look like 'diet food'"

---

### 3.2 Health Conditions & Medications
**Schema Addition:**
```prisma
model HealthProfile {
  id                    String   @id @default(cuid())
  userId                String   @unique

  // Medical
  medicalConditions     String   @default("[]") // JSON: ["pcos", "hypothyroid"]
  allergies             String   @default("[]") // Severe allergies
  medications           String   @default("[]") // Affects appetite/metabolism

  // Metabolic
  estimatedTDEE         Int?     // Calculated from actual results
  metabolicAdaptation   Float?   // Higher/lower than expected

  // Digestive
  foodSensitivities     String   @default("[]") // Causes issues but not allergies
  digestiveIssues       String?  // IBS, etc.

  // Menstrual (if applicable)
  tracksPeroid          Boolean  @default(false)
  cycleLength           Int?

  lastUpdated DateTime @default(now())

  user User @relation(fields: [userId], references: [id])
}

model PeriodLog {
  id              String   @id @default(cuid())
  userId          String
  date            DateTime
  cycleDay        Int      // Day 1-28+
  phase           String   // follicular, ovulation, luteal

  // Symptoms that affect nutrition
  cravingsLevel   Int?     // 1-10
  hungerLevel     Int?     // 1-10
  bloating        Boolean  @default(false)

  user User @relation(fields: [userId], references: [id])

  @@index([userId, date])
}
```

**Why This Matters:**
- PCOS users need different macro ratios
- Thyroid conditions affect metabolism
- Menstrual cycle tracking enables: "Luteal phase - expect higher cravings, here are satisfying high-volume meals"
- Medication interactions: "Taking medication that increases appetite? Here are high-satiety low-calorie options"

---

## Priority 4: AI Memory & Learning System

### 4.1 AI Coaching Sessions
**Schema Addition:**
```prisma
model CoachingSession {
  id              String   @id @default(cuid())
  userId          String
  timestamp       DateTime @default(now())

  // Session context
  triggerType     String   // daily_checkin, user_question, struggle_detected
  userMessage     String?

  // AI response
  aiMessage       String
  aiInsights      String?  // JSON of insights used
  recommendationsMade String // JSON array

  // Outcome
  userFeedback    String?  // helpful, not_helpful
  actionTaken     Boolean  @default(false)

  user User @relation(fields: [userId], references: [id])

  @@index([userId, timestamp])
}
```

**Why This Matters:**
- AI builds a "memory" of past conversations
- Knows what advice worked: "Last time you struggled, adding a protein shake helped"
- Personalized coaching style: "User responds better to tough love vs gentle encouragement"

---

### 4.2 Preference Confidence Scores
**Enhance existing Preferences model:**
```prisma
model Preferences {
  id              String @id @default(cuid())
  userId          String @unique

  // Existing fields...

  // NEW: Confidence scores (how sure are we?)
  preferenceConfidence  String @default("{}") // JSON: {"chickenLove": 0.95, "avoidsDairy": 0.3}

  // NEW: Learning metadata
  lastLearningUpdate    DateTime?
  totalMealsAnalyzed    Int @default(0)
  preferenceDrift       String? // JSON tracking how preferences change over time
}
```

**Why This Matters:**
- "User stated they dislike fish (confidence: 0.2) but has ordered salmon 3 times (confidence: 0.9)"
- AI can ask clarifying questions: "I noticed you ordered salmon - should I recommend more fish options?"
- Adapts as tastes change

---

## Priority 5: Social & Lifestyle Context

### 5.1 Social Eating Profile
**Schema Addition:**
```prisma
model LifestyleContext {
  id                  String   @id @default(cuid())
  userId              String   @unique

  // Household
  cookingForFamily    Boolean  @default(false)
  familySize          Int?
  kidsAges            String?  // JSON array

  // Social
  eatsWithCoworkers   Boolean  @default(false)
  frequentDinner      Boolean  @default(false)
  socialEatingStyle   String?  // flexible, strict, balanced

  // Schedule
  workSchedule        String?  // 9-5, shift_work, irregular
  travelFrequency     String?  // never, monthly, weekly
  mealPrepDay         String?  // sunday, multiple, none

  // Budget (more detail)
  monthlyFoodBudget   Int?
  willingToPayMore    Boolean  @default(false)

  user User @relation(fields: [userId], references: [id])
}
```

**Why This Matters:**
- Family context: "You're cooking for kids - here are macro-friendly meals the whole family will eat"
- Work context: "Lunch meetings common? Here are business-lunch restaurants with good options"
- Budget-aware: "Your budget is tight this week - here are cost-effective high-protein meals"

---

## Implementation Strategy

### Phase 1: Quick Wins (Week 1-2)
1. **Add meal feedback** - simplest high-impact feature
   - 3-question prompt after meals
   - Start building preference database

2. **Track adherence automatically** - no user input needed
   - Calculate from existing meal logs
   - Show weekly adherence score

3. **Enhance AI prompts with existing data**
   - Use meal history in prompts
   - Reference past successful meals

### Phase 2: Core Personalization (Week 3-6)
1. **Implement progress tracking**
   - Weekly weight check-ins
   - Body metrics dashboard
   - AI analyzes trends

2. **Add contextual awareness**
   - Daily context log (1-minute daily survey)
   - Workout tracking integration
   - Stress/sleep correlation analysis

3. **Build preference learning system**
   - Analyze meal choices vs. stated preferences
   - Auto-update confidence scores
   - Weekly "Did you know?" insights

### Phase 3: Advanced AI Coaching (Week 7-12)
1. **Implement health profiles**
   - Medical conditions
   - Menstrual tracking (opt-in)
   - Medication awareness

2. **Add coaching memory**
   - Session history
   - Long-term conversation context
   - Proactive check-ins

3. **Social/lifestyle optimization**
   - Family meal planning
   - Social eating strategies
   - Travel mode

---

## AI Prompt Enhancement Examples

### Before (Generic):
```
You are Rovia, a nutrition coach. User needs 800 calories, 60g protein.
Recommend meals from Chipotle.
```

### After (Deeply Personalized):
```
You are Rovia, a personal AI nutrition coach for [User Name].

CONTEXT YOU KNOW ABOUT THEM:
- Goal: Recomp (4 months in, lost 8lbs, gaining strength)
- Today: Wednesday, post-workout, moderate stress (6/10)
- Last 7 days: 85% protein adherence (great!), 60% calorie adherence (struggling)
- Preferences (learned from behavior):
  * LOVES: Chicken (rated 4.8/5 avg), extra cheese (+90% of orders), guac (+70%)
  * AVOIDS: Black beans (ordered only 2x in 40 meals)
  * Pattern: Orders double protein 80% of the time
- Current streak: 4 days hitting protein target
- Menstrual cycle: Day 12 (follicular phase, higher energy, moderate hunger)
- Budget: Medium ($15-20/meal okay)
- Social: Usually eats solo at desk

MEAL HISTORY INSIGHTS:
- Best rated Chipotle order: "Double Chicken Bowl" (5/5 taste, 4/5 satiety)
- Hasn't tried Carne Asada option yet
- Tends to order lighter carbs post-workout

TODAY'S TARGETS: 800 cal, 60g protein remaining

COACHING APPROACH:
- User responds well to celebratory tone + specific numbers
- Likes detailed build instructions
- Appreciates cost breakdowns

Now recommend Chipotle meals that fit their macros AND their patterns.
Don't suggest black beans. DO suggest double protein and familiar favorites.
Maybe introduce Carne Asada as a variation.
```

---

## Metrics to Track

### User Engagement
- Feedback completion rate
- Daily active users
- Session length
- Feature usage

### AI Effectiveness
- Recommendation acceptance rate
- Meal satisfaction ratings
- Adherence improvement over time
- User retention

### Personalization Quality
- Preference prediction accuracy
- Macro adherence correlation
- Progress toward goals
- User-reported helpfulness

---

## Next Steps

1. **Choose your Phase 1 priorities** - I can help implement any of these
2. **Update schema incrementally** - don't have to do everything at once
3. **A/B test AI personalization** - measure if it actually improves outcomes
4. **Build feedback loops first** - data quality determines AI quality

Want me to help implement any of these features? I'd suggest starting with **meal feedback** - it's the highest ROI for AI personalization.
