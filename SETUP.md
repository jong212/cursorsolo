# 🚀 Setup Guide for Content Collection System

Based on `doc/devguide.mdc` requirements, this guide will help you set up the complete data collection system.

## 📋 Prerequisites

- [Supabase account](https://supabase.com) with a project created
- [Supabase CLI](https://supabase.com/docs/guides/cli) installed (optional, for Edge Functions)

## 🔧 1. Environment Variables

Create a `.env.local` file in the project root with your Supabase credentials:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### How to get these values:
1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **Settings** → **API**
4. Copy the values from "Project API keys" section:
   - **URL**: Your project URL
   - **anon public**: Public anonymous key (for `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
   - **service_role**: Service role key (for `SUPABASE_SERVICE_ROLE_KEY`)

⚠️ **Security Note**: The service role key has admin privileges. Never expose it to the client!

## 🗄️ 2. Database Setup

**Quick Setup**: Copy and paste the entire `database-setup.sql` file into your Supabase SQL Editor and run it. This will create all tables, indexes, test data, and security policies at once.

Or run these commands manually:

### Create Tables

```sql
-- Sources table: External content sources configuration
CREATE TABLE IF NOT EXISTS public.sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,                    -- Human-readable source name
  type TEXT NOT NULL CHECK (type IN ('rss','html','api')),
  url TEXT NOT NULL,                     -- Source URL to fetch from
  enabled BOOLEAN NOT NULL DEFAULT true, -- Active/inactive flag
  last_success_at TIMESTAMPTZ,          -- Last successful collection
  status_msg TEXT,                       -- Latest status/error message
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Articles table: Collected and normalized content
CREATE TABLE IF NOT EXISTS public.articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES public.sources(id) ON DELETE CASCADE,
  title TEXT NOT NULL,                   -- Article title (max 500 chars)
  summary TEXT,                          -- Article summary (max 2000 chars)
  original_url TEXT NOT NULL,            -- Original article URL
  canonical_url TEXT,                    -- Canonical URL (often from GUID)
  thumbnail_url TEXT,                    -- Featured image URL
  author TEXT,                           -- Article author
  published_at TIMESTAMPTZ,              -- Original publication date
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  raw_meta JSONB,                        -- Original metadata from source
  hash TEXT NOT NULL,                    -- Deduplication hash
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Create Indexes and Constraints

```sql
-- Unique constraint for deduplication
CREATE UNIQUE INDEX IF NOT EXISTS ux_articles_hash ON public.articles(hash);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_sources_enabled ON public.sources(enabled);
CREATE INDEX IF NOT EXISTS idx_articles_status ON public.articles(status);
CREATE INDEX IF NOT EXISTS idx_articles_published ON public.articles(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_source_id ON public.articles(source_id);
```

### Create Update Trigger

```sql
-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_sources_updated_at ON public.sources;
CREATE TRIGGER trg_sources_updated_at
  BEFORE UPDATE ON public.sources
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
```

### Insert Test Data

```sql
-- Add a test RSS source
INSERT INTO public.sources (name, type, url, enabled) VALUES
('Hacker News RSS', 'rss', 'https://hnrss.org/newest', true),
('Dev.to RSS', 'rss', 'https://dev.to/feed', true);
```

## ⚡ 3. Edge Function Setup

### Option A: Using Supabase CLI (Recommended)

1. **Initialize Supabase in your project:**
   ```bash
   supabase init
   ```

2. **Link to your project:**
   ```bash
   supabase link --project-ref your-project-id
   ```

3. **Create the Edge Function:**
   ```bash
   supabase functions new crawl_manual
   ```

4. **Replace the generated code** with the implementation from `.cursor/rules/data-collection.mdc`

5. **Deploy the function:**
   ```bash
   supabase functions deploy crawl_manual
   ```

6. **Set environment variables for the function:**
   ```bash
   supabase secrets set SUPABASE_URL=https://your-project-id.supabase.co
   supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

### Option B: Using Dashboard (Alternative)

1. Go to **Edge Functions** in your Supabase dashboard
2. Create a new function named `crawl_manual`
3. Copy the Edge Function code from the data collection rules
4. Set the required environment variables in the function settings

## 🧪 4. Testing the Setup

### Test Database Connection

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Open [http://localhost:3000](http://localhost:3000)

3. You should see the Content Collection System interface

### Test Collection Process

1. Click the **"Run Collection"** button
2. Check the results:
   - **Success**: You'll see inserted/skipped counts
   - **Error**: Check the error message for troubleshooting

### Common Issues and Solutions

#### ❌ "Server configuration error"
- **Cause**: Missing environment variables
- **Solution**: Check your `.env.local` file and restart the dev server

#### ❌ "Collection service error (404)"
- **Cause**: Edge Function not deployed or incorrect name
- **Solution**: Deploy the `crawl_manual` function to Supabase

#### ❌ "Collection service error (500)"
- **Cause**: Edge Function error (missing env vars, database connection)
- **Solution**: Check Supabase logs and function environment variables

#### ❌ No sources processed
- **Cause**: No enabled sources in database
- **Solution**: Insert test data using the SQL above

## 📊 5. Monitoring and Debugging

### View Logs
- **Edge Function logs**: Supabase Dashboard → Edge Functions → crawl_manual → Logs
- **API Route logs**: Check your terminal/console where Next.js is running

### Database Queries
```sql
-- Check sources
SELECT * FROM public.sources;

-- Check recent articles
SELECT s.name, a.title, a.fetched_at, a.status 
FROM public.articles a 
JOIN public.sources s ON a.source_id = s.id 
ORDER BY a.fetched_at DESC 
LIMIT 10;

-- Check collection statistics
SELECT 
  s.name,
  s.last_success_at,
  s.status_msg,
  COUNT(a.id) as article_count
FROM public.sources s 
LEFT JOIN public.articles a ON s.id = a.source_id 
GROUP BY s.id, s.name, s.last_success_at, s.status_msg;
```

## 🔄 6. Next Steps

Once basic collection is working:

1. **Add more sources** to the `sources` table
2. **Set up Row Level Security (RLS)** for production
3. **Add cron scheduling** for automatic collection
4. **Implement content approval workflow**
5. **Add monitoring and alerting**

## 🆘 Need Help?

- Check the [Supabase Documentation](https://supabase.com/docs)
- Review `doc/devguide.mdc` for detailed requirements
- Check the Cursor Rules in `.cursor/rules/` for implementation patterns

---

🎉 **You're ready to start collecting content!** The system will fetch articles from RSS feeds, deduplicate them, and store them in your database.
