# Запуск застосунку snap-shot.ai (`app/`)

## Що це

У каталозі **`app/`** лежить повний код **snap-shot.ai**: React (Vite), Supabase клієнт, Edge Functions у `app/supabase/functions/`, міграції в `app/supabase/migrations/`.

Корінь репозиторію (`specs/`, `.specify/`) — це **Spec Kit**: специфікація, план і задачі для доробки (див. `specs/001-snapshot-ai-rebuild/tasks.md`).

## Вимоги

- **Node.js** 18+ (рекомендовано 20 або 22)
- **npm** (є `package-lock.json`)
- Обліковий запис Supabase і ключі з Dashboard → Settings → API

## Кроки

### 1. Перейти у застосунок

```bash
cd app
```

### 2. Змінні середовища

```bash
cp .env.example .env
```

Відредагуйте **`app/.env`** (файл не потрапляє в git):

| Змінна | Звідки |
|--------|--------|
| `VITE_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `VITE_SUPABASE_PROJECT_ID` | той самий `project-ref` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | anon / publishable key |
| `SUPABASE_ACCESS_TOKEN` | (опційно) для `npm run db:link` / `db:push` — Account → Access Tokens |

У `app/vite.config.ts` є fallback на конкретний ref — для **власного** проєкту краще явно задати все в `.env`.

### 3. Залежності

```bash
npm install
```

### 4. Запуск dev-сервера

```bash
npm run dev
```

Зазвичай відкрийте **http://localhost:8080** (порт задається в `vite.config.ts`).

### 5. Міграції БД (опційно)

Потрібен Supabase CLI і токени в `.env`:

```bash
npm run db:link
npm run db:push
```

## Продовження розробки

1. Зміни в коді — у **`app/`** (комітьте з кореня репо: `git add app/...`).
2. Оновлення вимог / чекліст задач — у **`specs/001-snapshot-ai-rebuild/`** (потім `/speckit-implement` або ручні PR за `tasks.md`).

## English (short)

1. `cd app && cp .env.example .env` — fill Supabase `VITE_*` vars.
2. `npm install && npm run dev` — open http://localhost:8080.
3. Optional: `npm run db:link` then `npm run db:push` for migrations.

Never commit `.env`.
