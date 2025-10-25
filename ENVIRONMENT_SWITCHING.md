# 🔄 Environment Switching Guide

## Quick Reference

### Current Environment Detection
The project uses `.env` file to configure which Supabase project to connect to.

```env
# Production Environment
VITE_SUPABASE_PROJECT_ID="cccktfactlzxuprpyhgh"
VITE_SUPABASE_PUBLISHABLE_KEY="eyJhbGc..."
VITE_SUPABASE_URL="https://cccktfactlzxuprpyhgh.supabase.co"

# Staging Environment (update after creating staging project)
# VITE_SUPABASE_PROJECT_ID="[your-staging-ref]"
# VITE_SUPABASE_PUBLISHABLE_KEY="[staging-anon-key]"
# VITE_SUPABASE_URL="https://[your-staging-ref].supabase.co"
```

---

## Switching to Staging

### Step 1: Update .env File
Replace the values in `.env` with your staging credentials:

```env
VITE_SUPABASE_PROJECT_ID="[your-staging-ref]"
VITE_SUPABASE_PUBLISHABLE_KEY="[staging-anon-key]"
VITE_SUPABASE_URL="https://[your-staging-ref].supabase.co"
```

### Step 2: Restart Development Server
```bash
# Stop the current server (Ctrl+C)
# Then restart
npm run dev
```

### Step 3: Verify Connection
1. Open the app in browser
2. Check browser console for Supabase connection logs
3. Verify you're connected to staging by checking the URL in network tab

---

## Switching Back to Production

### Step 1: Restore Production Credentials
```env
VITE_SUPABASE_PROJECT_ID="cccktfactlzxuprpyhgh"
VITE_SUPABASE_PUBLISHABLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNjY2t0ZmFjdGx6eHVwcnB5aGdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0MjQwMDUsImV4cCI6MjA3MzAwMDAwNX0.JmpRczZr46IUVpv_vkBopf9zovD9Z5muwF4wmX7ac-Q"
VITE_SUPABASE_URL="https://cccktfactlzxuprpyhgh.supabase.co"
```

### Step 2: Restart Server
```bash
npm run dev
```

---

## Best Practices

### ✅ DO:
- Always test changes in staging first
- Keep staging and production credentials documented separately
- Use test API credentials in staging (Razorpay test mode, Maya staging)
- Commit code changes, but never commit `.env` changes
- Clear browser cache when switching environments

### ❌ DON'T:
- Never use production API keys in staging
- Never test real payments in staging
- Don't deploy to production without staging validation
- Don't modify production data during testing
- Don't share staging credentials publicly

---

## Environment-Specific Configuration

### Edge Functions
Edge functions automatically use the secrets configured in the respective Supabase project:

**Staging Project Secrets:**
- Maya staging/test API keys
- Razorpay test mode keys
- Algolia staging index credentials

**Production Project Secrets:**
- Maya production API keys
- Razorpay live mode keys
- Algolia production index credentials

### Database
Each environment has its own isolated database:
- **Staging**: Test data, can be reset anytime
- **Production**: Real customer data, never modify directly

---

## Troubleshooting

### Issue: Changes not reflecting after switching
**Solution:** 
1. Stop dev server completely
2. Clear browser cache and cookies
3. Restart dev server
4. Hard refresh browser (Ctrl+Shift+R)

### Issue: Authentication not working
**Solution:**
- Check that you're using correct environment credentials
- Verify email provider is configured in the Supabase project
- Check that user exists in the correct environment

### Issue: API calls failing
**Solution:**
- Verify edge function secrets are set in the correct project
- Check edge function logs in Supabase dashboard
- Ensure you're using staging API endpoints in staging

---

## Deployment Notes

### Lovable Deployment
When you deploy via Lovable, it uses the `.env` values at build time:
- Make sure `.env` has **PRODUCTION** credentials before deploying
- Lovable reads `.env` during build process
- The deployed app will connect to whichever Supabase project is in `.env`

### Important
⚠️ **Before deploying to production, always ensure `.env` contains production credentials!**

---

## Quick Checklist

**Before Testing in Staging:**
- [ ] `.env` updated with staging credentials
- [ ] Dev server restarted
- [ ] Browser cache cleared
- [ ] Verified connection in network tab

**Before Deploying to Production:**
- [ ] All changes tested in staging
- [ ] `.env` updated with production credentials
- [ ] No breaking changes identified
- [ ] All edge functions working
- [ ] Database migrations applied to production

---

**Next:** See `STAGING_SETUP_GUIDE.md` for complete staging environment setup instructions.
