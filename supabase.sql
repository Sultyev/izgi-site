-- Выполните один раз: Supabase → SQL Editor → New query → вставить → Run
create table if not exists public.kv (
  key text primary key,
  value jsonb not null default '{}'::jsonb
);
-- Доступ только у серверной функции (ключ service_role). Из браузера таблица закрыта.
alter table public.kv enable row level security;
