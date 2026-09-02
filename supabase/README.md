# Syncora — Database (Этап 1)

## Структура
- `migrations/` — реальные миграции для Supabase (Postgres + pgvector).
  Применять по порядку 0001 → 0004 через Supabase SQL Editor или Supabase CLI.
- `seed.sql` — demo/dev seed-данные (стабильные UUID для demo-пользователя,
  воркспейсов и проекта — те же id, что зашиты как fallback-константы в
  `lib/db/demo-ids.ts`). Опционально, но рекомендуется для локальной разработки.
- `dev/` — вспомогательные скрипты **только для локальной разработки/тестирования**:
  - `0000_mock_supabase_auth.sql` — эмулирует схему `auth.users` / `auth.uid()`
    на голом Postgres (в реальном Supabase это уже есть, накатывать НЕ нужно).
  - `test_tenant_isolation.sql` — ручной smoke-тест, доказывающий что RLS
    реально изолирует данные между воркспейсами и соблюдает роли.

## Как накатить в реальный Supabase
1. Открой SQL Editor в своём Supabase-проекте.
2. Выполни по очереди файлы из `migrations/`: 0001, 0002, 0003, 0004.
3. (опционально) Выполни `seed.sql`, если хочешь, чтобы demo-логика
   (`x-user-id` отсутствует → фолбэк на demo-пользователя) сразу работала.
4. Готово — таблицы, RLS-политики и функции (`check_ai_rate_limit` и др.) созданы.
5. Пропиши env-переменные из `.env.example` (`NEXT_PUBLIC_SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY`).

## Важное архитектурное решение: все ID — uuid
Исходный in-memory прототип использовал человекочитаемые строковые id
(`usr_demo`, `ws_acme`, `tsk_...`). Реальная схема Postgres требует `uuid`
для совместимости с `auth.users.id` (Supabase Auth всегда генерирует
настоящий UUID — см. Этап 2). Поэтому:
- Все PK/FK в миграциях — `uuid`.
- Генерация новых id в `lib/db/storage.ts` и роутах переведена на
  `crypto.randomUUID()`.
- Старые demo-константы (`usr_demo` и т.п.) заменены на фиксированные UUID
  в `lib/db/demo-ids.ts` — используй `seed.sql`, чтобы эти id существовали
  в базе.

## Service-role вместо RLS + auth.uid() (временно)
`lib/db/storage.ts` обращается к БД через `SUPABASE_SERVICE_ROLE_KEY`
(в обход RLS), потому что сервер пока аутентифицирует через заголовок
`x-user-id`, а не через настоящую Supabase Auth-сессию — валидного JWT для
`auth.uid()` ещё нет. Авторизация вместо этого остаётся в коде
(`db.authorize()` / `lib/db/rbac.ts`), как и было в in-memory версии. RLS,
уже написанный и протестированный в миграциях, остаётся как defense-in-depth
на будущее — см. комментарий в `lib/db/supabase-client.ts` для полного
обоснования и что стоит пересмотреть на Этапе 2.

## Статус
Этап 1 (переход storage-слоя на Postgres/Supabase) реализован и проверен
сквозным способом на локальном Postgres 16 + pgvector + PostgREST:
- 4 миграции применяются без ошибок с нуля;
- RLS подтверждённо изолирует тенантов (owner одного workspace не видит
  данные другого, даже подставив чужой workspace_id напрямую);
- viewer не может создавать задачи, owner/member — может (RBAC на уровне БД,
  задел на будущее);
- `lib/db/storage.ts` полностью переписан на supabase-js, все 22 файла,
  ранее обращавшихся к `Map` напрямую, переведены на `await db.method()`;
- весь проект проходит `tsc --noEmit` без ошибок;
- сквозной smoke-тест (реальный `@supabase/supabase-js` клиент → PostgREST →
  Postgres, включая вложенные JOIN и RPC для rate-limit) — пройден.

## Следующий шаг
Этап 2: полноценная аутентификация (Supabase Auth) вместо заголовка
`x-user-id`, после чего можно будет пересмотреть баланс между RLS и
проверками в коде для части путей.

---

# Этап 2 — Аутентификация (Supabase Auth)

## Статус: реализовано
- `middleware.ts` — проверяет Supabase-сессию на каждом запросе (страницы и
  `/api/*`), обновляет истёкший access token, редиректит неавторизованных на
  `/login`.
- `app/login`, `app/signup`, `app/auth/callback` — вход и регистрация через
  email + пароль.
- `lib/supabase/server.ts` / `lib/supabase/client.ts` — серверный и
  браузерный Supabase-клиенты с cookie-based сессиями.
- `getAuthenticatedUser()` (в `lib/supabase/server.ts`) заменил
  `req.headers.get('x-user-id')` во всех 20 API-роутах — `userId` теперь
  криптографически подтверждён Supabase Auth, а не взят на веру из заголовка,
  который клиент мог подставить произвольно.
- Миграция `0005_auth_user_sync.sql` — Postgres-триггер, автоматически
  создающий `public.users` при регистрации в `auth.users`, плюс синхронизация
  email при его смене через Supabase Auth.
- Демо-переключатель пользователей (`switchUser`) полностью убран — заменён
  на настоящий вход/выход. `hooks/use-workspace-context.tsx` теперь
  загружает `currentUser`/`currentWorkspace` асинхронно из реальной сессии
  вместо хардкод-заглушек.

## Архитектурное решение: service-role остаётся, RLS — как backstop
`lib/db/storage.ts` продолжает использовать `SUPABASE_SERVICE_ROLE_KEY`
(в обход RLS) даже после появления настоящей Auth-сессии. Причины:
1. Единый, уже протестированный путь авторизации (`db.authorize()`) вместо
   двух параллельных механизмов (RLS и код), которые могут разойтись.
2. Часть операций (RAG-индексация, activity log, retro summary) не
   укладывается в модель "свои же строки", для которой RLS удобнее всего.

RLS-политики в `supabase/migrations/` остаются как defense-in-depth: если
где-то в коде забудут вызвать `db.authorize()`, RLS всё ещё не даст утечь
данным между тенантами. Подробное обоснование — в комментарии
`lib/db/supabase-client.ts`.

## Настройка Supabase Auth в консоли
1. В Supabase Dashboard → Authentication → Providers включи Email.
2. Реши, нужно ли подтверждение email при регистрации (Authentication →
   Settings → "Confirm email"). Если включено, страница `/signup` покажет
   экран "Check your email", а `app/auth/callback/route.ts` обменяет ссылку
   подтверждения на сессию.
3. Пропиши Site URL и Redirect URLs (Authentication → URL Configuration) —
   должны включать `<твой домен>/auth/callback`.
4. Накати миграцию `0005_auth_user_sync.sql`, если ещё не применена.

## Осталось за рамками этой сессии
- Сквозной тест реальной регистрации/логина против настоящего Supabase-
  проекта (Этап 1 тестировался через локальный Postgres + PostgREST-эмулятор;
  сам Supabase Auth — сервис, который нельзя поднять локально тем же
  способом, поэтому эта часть требует реального проекта для финальной
  проверки).
- OAuth-провайдеры (Google/GitHub) и magic link — не запрашивались в этой
  итерации, только email+пароль.
- `inviteUserByEmail()` (в `workspaces/route.ts`, `invite_member`) отправляет
  реальное письмо через Supabase Admin Auth API — предполагает, что в
  Supabase-проекте настроен email-провайдер (Dashboard → Authentication →
  Email Templates / SMTP). На бесплатном тарифе Supabase есть встроенная
  отправка с ограничением по частоте — для продакшна стоит подключить
  собственный SMTP.

---

# Этап 3 — RBAC-wrapper для мутирующих эндпоинтов

## Статус: реализовано
`lib/db/authorize-or-deny.ts` — единая точка проверки прав, заменившая
повторяющийся 4-строчный блок:

```ts
const auth = await db.authorize(workspaceId, userId, 'task:create');
if (!auth.authorized) {
  return NextResponse.json({ error: auth.error }, { status: 403 });
}
```

на:

```ts
const auth = await authorizeOrDeny(workspaceId, userId, 'task:create');
if (auth instanceof NextResponse) return auth;
```

Применено во всех 13 файлах, где раньше был ручной вызов `db.authorize()`
(26 мест) — единообразный формат ошибки, меньше шанса, что кто-то забудет
`return` или напишет неверный статус-код при копипасте.

## Почему не HOF-обёртка вокруг всего route handler
Мутирующие роуты в этом проекте диспетчеризуют `Permission` динамически —
`action` приходит в теле запроса (`{ action: 'create' | 'update' | 'delete',
... }`), и нужное разрешение (`task:create` vs `task:delete`) известно только
после того, как обработчик уже начал выполняться и распарсил `body`. Обёртка
над всем `export async function POST(...)` не смогла бы выбрать нужный
`Permission`, не реализуя этот диспетчинг заново. Поэтому `authorizeOrDeny()`
остаётся вызовом внутри каждой `action`-ветки, а не декоратором над
хендлером — это убирает дублирование форматирования ошибки, но оставляет
явным, какое разрешение проверяется в какой ветке (что само по себе полезно
при чтении кода).

## Что не менялось
Сама модель прав (`lib/db/rbac.ts`: `Permission`, `ROLE_PERMISSIONS`,
`hasPermission()`) и метод `db.authorize()` не тронуты — Этап 3 убирал
дублирование вызова проверки, а не переделывал саму проверку.

