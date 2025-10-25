#!/bin/bash
# Script to set staging environment secrets
# Run this after linking to your staging project: supabase link --project-ref YOUR_STAGING_PROJECT_ID

# eSIM Access credentials
supabase secrets set ESIMACCESS_ACCESS_CODE=ec82ebbb23cd4f3dbf84a9f1fbc69029
supabase secrets set ESIMACCESS_SECRET_KEY=b85736fa89654048b2c3de7bd288305e

# Provider credentials (aliases for eSIM Access)
supabase secrets set PROVIDER_ACCESS_CODE=ec82ebbb23cd4f3dbf84a9f1fbc69029
supabase secrets set PROVIDER_SECRET_KEY=b85736fa89654048b2c3de7bd288305e
supabase secrets set PROVIDER_API_URL=https://api.esimaccess.com

# Maya API credentials
supabase secrets set MAYA_API_KEY=nL8ZpV0tvusJ
supabase secrets set MAYA_API_SECRET=ukEY9HzpPmVbTieZTQE3tIVnfw1cu885aSGxUfO2d7OLPRilAmXAbMyDpxIHZ7Ng
supabase secrets set MAYA_API_URL=https://api.mayamobile.io

# Algolia credentials
supabase secrets set ALGOLIA_APPLICATION_ID=ESBNX49O6L
supabase secrets set ALGOLIA_ADMIN_API_KEY=6c52d8076ece4d9fc3c2e36f11240d9c
supabase secrets set ALGOLIA_SEARCH_API_KEY=f9eaae00bf847f96caffec70f0d7958e

# Exchange Rate API
supabase secrets set EXCHANGE_RATE_API_KEY=e90fb6a858b80efba9b771ac

# Note: Stripe and Razorpay keys excluded as requested
# You can set test/sandbox keys for these separately if needed

echo "✅ All staging secrets have been set!"
echo "⚠️  Remember to set test Stripe and Razorpay keys separately for payment testing"
