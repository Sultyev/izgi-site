# Сайт школы ИЗГИ

Публичный сайт + кабинет сотрудников + панель директора.
Сайт — статические файлы (GitHub Pages). Серверная часть — Supabase Edge Function `supabase/functions/api/index.ts`,
данные лежат в таблице `kv` (см. `supabase.sql`). Пароли хранятся только как хэш.

## Настройка (один раз)
1. Supabase → SQL Editor: выполнить `supabase.sql` (создаёт таблицу).
2. Supabase → Edge Functions → создать функцию `api`, вставить код из `supabase/functions/api/index.ts`,
   в настройках функции выключить «Verify JWT» и нажать Deploy.
3. Edge Functions → Secrets: добавить `AUTH_SECRET` (случайная строка от 32 символов), `DIRECTOR_LOGIN`, `DIRECTOR_PASSWORD`
   (и при желании `DIRECTOR_NAME`).
4. GitHub: репозиторий → Settings → Pages → Deploy from a branch → `main` / `(root)`.
5. Открыть адрес сайта, `/staff.html`, войти как директор и создать сотрудников.

Адрес функции записан в `js/config.js`. Директор создаётся автоматически при первом входе.
