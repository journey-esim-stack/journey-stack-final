# 🚀 Staging Environment Setup Guide

## Overview
This guide will help you set up a separate staging environment for JourneyStack to safely test changes before deploying to production.

---

## Step 1: Create Staging Supabase Project

### 1.1 Create New Project
1. Go to https://supabase.com/dashboard
2. Click "New Project"
3. Name it: `journeystack-staging`
4. Choose same region as production for consistency
5. Generate a strong database password (save it securely)
6. Wait for project creation (~2 minutes)

### 1.2 Copy Project Credentials
After creation, go to Project Settings > API and note:
- **Project URL**: `https://[your-staging-ref].supabase.co`
- **Anon Key**: `eyJhbGc...` (public key)
- **Service Role Key**: `eyJhbGc...` (secret key, keep secure)

---

## Step 2: Set Up Database Schema

### 2.1 Run Migrations
1. In your staging Supabase project, go to SQL Editor
2. Copy all migration files from `supabase/migrations/` folder
3. Run them **in chronological order** (by timestamp in filename)
4. Verify all tables are created successfully

### 2.2 Verify Schema
Check that these critical tables exist:
- ✅ `agent_profiles`
- ✅ `esim_plans` 
- ✅ `orders`
- ✅ `wallet_balances`
- ✅ `pricing_rules`
- ✅ `agent_pricing`
- ✅ `user_roles`
- ✅ `audit_logs`

---

## Step 3: Configure Secrets

### 3.1 Set Edge Function Secrets
In your staging project, go to Project Settings > Edge Functions > Manage Secrets

Add these secrets (use **STAGING/TEST** credentials, NOT production):

**External API Secrets:**
```bash
MAYA_API_KEY=<staging_maya_key>
MAYA_API_SECRET=<staging_maya_secret>
MAYA_API_URL=https://api-staging.maya.com  # Or test endpoint

RAZORPAY_KEY_ID=<staging_razorpay_key_id>
RAZORPAY_KEY_SECRET=<staging_razorpay_secret>

ALGOLIA_APPLICATION_ID=<staging_algolia_app_id>
ALGOLIA_ADMIN_API_KEY=<staging_algolia_admin_key>
ALGOLIA_SEARCH_API_KEY=<staging_algolia_search_key>

EXCHANGE_RATE_API_KEY=<your_exchange_rate_key>  # Can reuse production
```

**Supabase Secrets (auto-detected):**
```bash
SUPABASE_URL=https://[your-staging-ref].supabase.co
SUPABASE_ANON_KEY=<staging_anon_key>
SUPABASE_SERVICE_ROLE_KEY=<staging_service_role_key>
```

### 3.2 Important Notes
- ⚠️ **NEVER use production API keys in staging**
- ⚠️ Contact Maya/Razorpay for test/sandbox credentials
- ⚠️ Create separate Algolia index for staging (e.g., `staging_esim_plans`)

---

## Step 4: Seed Test Data

### 4.1 Create Test Admin User
1. In staging Supabase, go to Authentication > Users
2. Create a test admin user:
   - Email: `admin@staging.journeystack.com`
   - Password: (strong password)
3. Note the user ID
4. Run this SQL to grant admin role:

```sql
INSERT INTO user_roles (user_id, role)
VALUES ('<admin_user_id>', 'admin');
```

### 4.2 Create Test Agent Profile
Run the seed script (see `supabase/seed-staging.sql` file)

---

## Step 5: Deploy Edge Functions

### 5.1 Install Supabase CLI
```bash
npm install -g supabase
```

### 5.2 Link to Staging Project
```bash
supabase link --project-ref [your-staging-ref]
```

### 5.3 Deploy Functions
```bash
supabase functions deploy
```

This deploys all functions in `supabase/functions/` to staging.

---

## Step 6: Update Frontend Configuration

### 6.1 Update .env File
Replace production credentials with staging:

```env
VITE_SUPABASE_PROJECT_ID="[your-staging-ref]"
VITE_SUPABASE_PUBLISHABLE_KEY="[staging-anon-key]"
VITE_SUPABASE_URL="https://[your-staging-ref].supabase.co"
```

### 6.2 Update Supabase Client
The client at `src/integrations/supabase/client.ts` will automatically use the new `.env` values.

---

## Step 7: Testing Checklist

### 7.1 Authentication Flow
- [ ] Can create new agent account
- [ ] Email confirmation works
- [ ] Login/logout works
- [ ] Password reset works

### 7.2 Agent Features
- [ ] Can view eSIM plans
- [ ] Search/filter works
- [ ] Add to cart works
- [ ] Wallet balance displays
- [ ] Can create eSIM order (test mode)
- [ ] Order appears in dashboard

### 7.3 Admin Features
- [ ] Can access admin pages
- [ ] Can approve agents
- [ ] Can view inventory
- [ ] Can manage pricing rules
- [ ] Can sync plans

### 7.4 Payment Flow (Test Mode)
- [ ] Razorpay test payment works
- [ ] Wallet topup works
- [ ] Wallet debit works
- [ ] Transaction history updates

---

## Step 8: Ongoing Usage

### Switching Between Environments

**To work on staging:**
1. Update `.env` with staging credentials
2. Run `npm run dev`
3. Make changes and test

**To switch back to production:**
1. Update `.env` with production credentials
2. Deploy only after staging validation

### Best Practices
- ✅ **Always test in staging first**
- ✅ Use test payment credentials in staging
- ✅ Keep staging data separate from production
- ✅ Regularly sync schema changes from production to staging
- ❌ Never use production API keys in staging
- ❌ Never test real payments in staging

---

## Troubleshooting

### Issue: Edge functions not working
**Solution:** Check that secrets are set in staging project settings

### Issue: Database queries failing
**Solution:** Verify RLS policies are created (run migrations again)

### Issue: Authentication not working
**Solution:** Check email provider settings in staging project

### Issue: Maya API errors
**Solution:** Verify you're using staging/test API endpoint and credentials

---

## Next Steps

Once staging is set up and validated:
1. ✅ Run security fixes in staging (Phase 1)
2. ✅ Test pricing consolidation in staging (Phase 2)
3. ✅ Validate search cleanup in staging (Phase 3)
4. ✅ Only deploy to production after full staging validation

---

## Support Resources

- Supabase Dashboard: https://supabase.com/dashboard/project/[your-staging-ref]
- Supabase Docs: https://supabase.com/docs
- Edge Function Logs: https://supabase.com/dashboard/project/[your-staging-ref]/functions
- SQL Editor: https://supabase.com/dashboard/project/[your-staging-ref]/sql

---

**Ready to proceed?** Once you've completed Steps 1-6, let me know and I'll start implementing Phase 1 security fixes in staging!
