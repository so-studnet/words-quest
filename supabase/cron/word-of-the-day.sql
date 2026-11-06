-- Words Quest: call the Word of the Day sender every hour (Supabase pg_cron + pg_net).
-- Run in the Supabase SQL Editor (docs/setup.md, "7."). This is not a migration:
-- replace the two placeholders first.
--   <CRON_SECRET>  the same value as CRON_SECRET in Vercel
--   <SITE>         your production domain from Vercel -> Domains, e.g. words-quest-abc.vercel.app
--                  (not a per-deployment URL: those are behind Vercel's login)

-- 1. Extensions (or Database -> Extensions -> pg_cron and pg_net)
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 2. Store CRON_SECRET encrypted in Vault
select vault.create_secret('<CRON_SECRET>', 'words_quest_cron_secret');

-- 3. Every hour at minute 5
select cron.schedule(
  'words-quest-word-of-the-day',
  '5 * * * *',
  $$
  select net.http_post(
    url := 'https://<SITE>/api/push/dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'words_quest_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
  $$
);

-- ---- Checks (run only when needed) ----
-- Scheduled jobs:          select jobname, schedule, active from cron.job;
-- Recent runs:             select status, return_message, start_time from cron.job_run_details order by start_time desc limit 5;
-- API answers (200 = ok):  select status_code, content::text, error_msg, created from net._http_response order by created desc limit 5;
-- Registered devices:      select endpoint, notify_hour, time_zone from public.push_subscriptions;
-- Sent:                    select * from public.push_deliveries order by sent_at desc limit 10;
-- Stop:                    select cron.unschedule('words-quest-word-of-the-day');
-- Change CRON_SECRET:      update vault.secrets set secret = '<new value>' where name = 'words_quest_cron_secret';
