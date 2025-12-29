#!/bin/bash

# Run all meal evaluation scripts
# Usage: ./scripts/run-evals.sh [--api]
#   --api: Also run API tests (requires dev server running)

echo "=================================="
echo "NUTRIX MEAL EVALUATION SUITE"
echo "=================================="
echo ""

FAILED=0

# Run meal distribution eval
echo "Running meal distribution evaluation..."
npx ts-node scripts/eval-meal-suggestions.ts
if [ $? -ne 0 ]; then
  FAILED=1
fi

echo ""

# Run scoring eval
echo "Running meal scoring evaluation..."
npx ts-node scripts/eval-meal-scoring.ts
if [ $? -ne 0 ]; then
  FAILED=1
fi

# Run API eval if --api flag is passed
if [ "$1" == "--api" ]; then
  echo ""
  echo "Running API evaluation (requires dev server)..."
  npx ts-node scripts/eval-meal-api.ts
  if [ $? -ne 0 ]; then
    FAILED=1
  fi
fi

echo ""
echo "=================================="
if [ $FAILED -eq 0 ]; then
  echo "ALL EVALUATIONS PASSED"
else
  echo "SOME EVALUATIONS FAILED"
fi
echo "=================================="

exit $FAILED
