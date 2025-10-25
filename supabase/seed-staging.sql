-- Staging Environment Seed Data
-- Run this script in your staging Supabase project SQL Editor after running migrations
-- This creates test data for development and testing

-- ============================================================================
-- STEP 1: Create Test Admin User Role
-- ============================================================================
-- First, create the admin user in Authentication > Users in Supabase Dashboard
-- Then replace <ADMIN_USER_ID> below with the actual user ID

-- INSERT INTO user_roles (user_id, role)
-- VALUES ('<ADMIN_USER_ID>', 'admin');

-- ============================================================================
-- STEP 2: Create Test Agent Profiles
-- ============================================================================
-- Create test agent profile for testing agent features
-- Replace <AGENT_USER_ID> with actual user ID from auth.users

-- Test Agent 1: Approved Agent (India, INR)
-- INSERT INTO agent_profiles (
--   user_id,
--   company_name,
--   contact_person,
--   phone,
--   country,
--   partner_type,
--   status,
--   markup_type,
--   markup_value,
--   wallet_currency,
--   logo_url
-- ) VALUES (
--   '<AGENT_USER_ID_1>',
--   'Test Travel Agency India',
--   'Test Agent India',
--   '+91-9876543210',
--   'India',
--   'agent',
--   'approved',
--   'percentage',
--   300,
--   'INR',
--   NULL
-- );

-- Test Agent 2: Approved Agent (USA, USD)
-- INSERT INTO agent_profiles (
--   user_id,
--   company_name,
--   contact_person,
--   phone,
--   country,
--   partner_type,
--   status,
--   markup_type,
--   markup_value,
--   wallet_currency,
--   logo_url
-- ) VALUES (
--   '<AGENT_USER_ID_2>',
--   'Test Travel Agency USA',
--   'Test Agent USA',
--   '+1-555-0123',
--   'United States',
--   'agent',
--   'approved',
--   'percentage',
--   300,
--   'USD',
--   NULL
-- );

-- Test Agent 3: Pending Approval
-- INSERT INTO agent_profiles (
--   user_id,
--   company_name,
--   contact_person,
--   phone,
--   country,
--   partner_type,
--   status,
--   markup_type,
--   markup_value,
--   wallet_currency
-- ) VALUES (
--   '<AGENT_USER_ID_3>',
--   'Pending Travel Co',
--   'Pending Agent',
--   '+1-555-9999',
--   'United Kingdom',
--   'agent',
--   'pending',
--   'percentage',
--   300,
--   'USD'
-- );

-- Test API Partner
-- INSERT INTO agent_profiles (
--   user_id,
--   company_name,
--   contact_person,
--   phone,
--   country,
--   partner_type,
--   status,
--   markup_type,
--   markup_value,
--   wallet_currency
-- ) VALUES (
--   '<API_PARTNER_USER_ID>',
--   'Test API Integration Corp',
--   'API Partner Test',
--   '+1-555-7777',
--   'Singapore',
--   'api_partner',
--   'approved',
--   'percentage',
--   30,
--   'USD'
-- );

-- ============================================================================
-- STEP 3: Add Test Wallet Balances
-- ============================================================================
-- Add initial balance for testing
-- Replace <AGENT_PROFILE_ID> with actual IDs from agent_profiles table

-- INSERT INTO wallet_balances (agent_id, balance, currency)
-- VALUES 
--   ('<AGENT_PROFILE_ID_1>', 10000.00, 'INR'),  -- ₹10,000 for Indian agent
--   ('<AGENT_PROFILE_ID_2>', 500.00, 'USD'),    -- $500 for US agent
--   ('<API_PARTNER_ID>', 1000.00, 'USD');       -- $1,000 for API partner

-- ============================================================================
-- STEP 4: Add Sample eSIM Plans (Test Data)
-- ============================================================================
-- Create sample plans for testing search and purchase flows

INSERT INTO esim_plans (
  title,
  description,
  country_name,
  country_code,
  data_amount,
  validity_days,
  currency,
  wholesale_price,
  is_active,
  admin_only,
  supplier_plan_id,
  supplier_name
) VALUES
  -- Popular destinations
  (
    'UAE - Dubai 5GB',
    '5GB data for United Arab Emirates, valid for 7 days',
    'United Arab Emirates',
    'AE',
    '5GB',
    7,
    'USD',
    12.99,
    true,
    false,
    'TEST-UAE-5GB-7D',
    'maya'
  ),
  (
    'Singapore 10GB',
    '10GB data for Singapore, valid for 14 days',
    'Singapore',
    'SG',
    '10GB',
    14,
    'USD',
    18.99,
    true,
    false,
    'TEST-SG-10GB-14D',
    'maya'
  ),
  (
    'Thailand 20GB',
    '20GB data for Thailand, valid for 30 days',
    'Thailand',
    'TH',
    '20GB',
    30,
    'USD',
    24.99,
    true,
    false,
    'TEST-TH-20GB-30D',
    'maya'
  ),
  (
    'United States 15GB',
    '15GB data for USA, valid for 30 days',
    'United States',
    'US',
    '15GB',
    30,
    'USD',
    29.99,
    true,
    false,
    'TEST-US-15GB-30D',
    'maya'
  ),
  (
    'United Kingdom 8GB',
    '8GB data for UK, valid for 14 days',
    'United Kingdom',
    'GB',
    '8GB',
    14,
    'USD',
    16.99,
    true,
    false,
    'TEST-UK-8GB-14D',
    'maya'
  ),
  (
    'Italy 12GB',
    '12GB data for Italy, valid for 21 days',
    'Italy',
    'IT',
    '12GB',
    21,
    'USD',
    19.99,
    true,
    false,
    'TEST-IT-12GB-21D',
    'maya'
  ),
  (
    'Spain 10GB',
    '10GB data for Spain, valid for 15 days',
    'Spain',
    'ES',
    '10GB',
    15,
    'USD',
    17.99,
    true,
    false,
    'TEST-ES-10GB-15D',
    'maya'
  ),
  (
    'Indonesia 25GB',
    '25GB data for Indonesia, valid for 30 days',
    'Indonesia',
    'ID',
    '25GB',
    30,
    'USD',
    22.99,
    true,
    false,
    'TEST-ID-25GB-30D',
    'maya'
  ),
  -- Regional plans
  (
    'Europe Multi-Country 50GB',
    '50GB data for 30+ European countries, valid for 30 days',
    'Europe',
    'EU',
    '50GB',
    30,
    'USD',
    49.99,
    true,
    false,
    'TEST-EU-50GB-30D',
    'maya'
  ),
  (
    'Asia Multi-Country 30GB',
    '30GB data for 15+ Asian countries, valid for 30 days',
    'Asia',
    'ASIA',
    '30GB',
    30,
    'USD',
    39.99,
    true,
    false,
    'TEST-ASIA-30GB-30D',
    'maya'
  ),
  -- Admin-only test plan
  (
    'Global Admin Test Plan',
    'Global coverage for admin testing only',
    'Global',
    'GLOBAL',
    '100GB',
    90,
    'USD',
    99.99,
    true,
    true,
    'TEST-GLOBAL-100GB-90D',
    'maya'
  ),
  -- Inactive plan (for testing filters)
  (
    'Inactive Test Plan',
    'This plan should not appear in search',
    'Test Country',
    'TC',
    '1GB',
    1,
    'USD',
    1.00,
    false,
    false,
    'TEST-INACTIVE',
    'maya'
  );

-- ============================================================================
-- STEP 5: Add Sample Pricing Rules (Optional)
-- ============================================================================
-- Add global pricing rules for testing
-- Note: These are commented out - uncomment and customize if needed

-- INSERT INTO pricing_rules (
--   rule_type,
--   target_id,
--   markup_type,
--   markup_value,
--   priority,
--   is_active
-- ) VALUES
--   ('country', 'AE', 'percent', 250, 100, true),
--   ('country', 'SG', 'percent', 280, 100, true),
--   ('country', 'US', 'percent', 320, 100, true);

-- ============================================================================
-- STEP 6: Verify Data
-- ============================================================================
-- Run these queries to verify data was inserted correctly

-- Check agent profiles
-- SELECT id, company_name, status, partner_type, wallet_currency FROM agent_profiles;

-- Check wallet balances
-- SELECT agent_id, balance, currency FROM wallet_balances;

-- Check eSIM plans
-- SELECT title, country_code, data_amount, validity_days, wholesale_price, is_active FROM esim_plans;

-- Check pricing rules
-- SELECT country_code, markup_type, markup_value, is_active FROM pricing_rules;

-- ============================================================================
-- NOTES:
-- ============================================================================
-- 1. Remember to replace all <PLACEHOLDER_IDS> with actual UUIDs
-- 2. Create test users in Authentication tab first
-- 3. Test payment credentials should be from Razorpay test mode
-- 4. Maya API should point to staging/test endpoint
-- 5. Algolia should use a separate staging index
-- ============================================================================
