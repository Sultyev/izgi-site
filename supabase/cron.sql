-- Выполните один раз в Supabase → SQL Editor. Раз в минуту вызывает функцию: напоминания о дедлайнах,
-- автоматическая отмена просроченных задач и месячные бонусы.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule('izgi-tick', '* * * * *', $$
  select net.http_post(
    url := 'https://wymbcshovhbwmjcmvvax.supabase.co/functions/v1/api/cron',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb
  );
$$);

-- Проверка: select * from cron.job;   Отключить: select cron.unschedule('izgi-tick');
