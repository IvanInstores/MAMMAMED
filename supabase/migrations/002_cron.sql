-- Controllo ogni minuto: sostituire jqwtcbnfgbfazyjokuzs con il codice del progetto Supabase
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'mammamed-tick',
  '* * * * *',
  $$ select net.http_post(
       url := 'https://jqwtcbnfgbfazyjokuzs.supabase.co/functions/v1/api',
       headers := '{"Content-Type":"application/json"}'::jsonb,
       body := '{"action":"tick"}'::jsonb
     ) $$
);
