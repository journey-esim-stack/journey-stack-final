-- Enable required extensions for scheduling HTTP calls
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- Add per-agent markup configuration with sensible defaults
alter table public.agent_profiles
  add column if not exists markup_type text not null default 'percent',
  add column if not exists markup_value numeric not null default 40;

-- Re-schedule the sync job to run every 5 minutes (idempotent)
-- First, try to unschedule if it already exists
do $$
begin
  perform cron.unschedule('sync-esim-plans-every-5-min');
exception when others then
  -- ignore if it doesn't exist
  null;
end $$;

-- Schedule the job to invoke the edge function
select
  cron.schedule(
    'sync-esim-plans-every-5-min',
    '*/5 * * * *',
    $$
    select
      net.http_post(
          url:='https://cccktfactlzxuprpyhgh.supabase.co/functions/v1/sync-esim-plans',
          headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNjY2t0ZmFjdGx6eHVwcnB5aGdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0MjQwMDUsImV4cCI6MjA3MzAwMDAwNX0.JmpRczZr46IUVpv_vkBopf9zovD9Z5muwF4wmX7ac-Q"}'::jsonb,
          body:='{}'::jsonb
      ) as request_id;
    $$
  );