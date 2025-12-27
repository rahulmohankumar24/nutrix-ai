# Testing Instructions for 6pm / 1600 Calories Issue

## Problem
At 6pm with 1600 calories remaining, system is suggesting 445 calorie meals instead of ~1200 calorie meals.

## Root Cause Found
The system is detecting meal type as "snack" instead of "dinner", which causes incorrect calorie targets.

## How to Test

### 1. Clear the cache first
```bash
curl -X POST http://localhost:3000/api/clear-cache
```

### 2. Check the logs when you click a restaurant

Look for these key indicators in the server terminal:

```
⏰ Time Detection: 18:30 → dinner  ← Should say "dinner" not "snack"!

🔥 MEAL DISTRIBUTION CALCULATION:
  Current time: 18:30
  Bedtime: 23:00
  Hours until bedtime: 4.5hrs
  Meals remaining: 1 (based on 2.75hrs per meal)
  Meal type detected: dinner  ← Should be "dinner"!
  User has remaining: 1600cal, 100g protein
  THIS MEAL TARGET: 1120cal, 75g protein  ← Should be high!

📊 AI MEAL BUILDER - STARTING
  Time of Day RECEIVED: dinner  ← Should match!
  ⚠️ CHECK: Is this correct?

  Daily Targets: 2500cal, 150g protein
  Current Progress: 900cal, 50g protein
  Remaining: 1600cal, 100g protein  ← Should match reality!

🎯 AI WILL BE TOLD TO CREATE MEALS WITH:
  Target for THIS meal: 1120cal, 75g protein  ← Should be high!
```

### 3. What to look for:

✅ **CORRECT:**
- Time detection shows "dinner" (not "snack")
- Meals remaining = 1-2
- THIS MEAL TARGET = 1000-1400 cal

❌ **WRONG:**
- Time detection shows "snack"
- THIS MEAL TARGET = 400-500 cal

### 4. If still wrong:

Check your system time:
```javascript
// In browser console:
new Date().getHours()  // Should be 18 or higher at 6pm
```

## Changes Made

1. Added time detection logging
2. Added detailed meal distribution logging
3. Made time ranges clearer:
   - 5-11am: breakfast
   - 11am-3pm: lunch
   - 3pm-6pm: snack
   - 6pm-10pm: dinner ← 6pm should hit this!
   - After 10pm: snack

4. Added warnings if calculations look wrong
