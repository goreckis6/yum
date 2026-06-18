# YumShare — cloud setup (Supabase + Railway)

The app now uses **Supabase** for accounts, the database and image storage, and
**Railway** to host the OpenAI extraction backend. Follow these steps once.

## 1. Supabase project

1. Create a project at https://supabase.com (free tier is fine).
2. Open **SQL Editor → New query**, paste the contents of
   [`supabase/schema.sql`](supabase/schema.sql) and **Run**. This creates:
   - `app_state` table (one JSON row per user) with row-level security,
   - the public `recipe-images` storage bucket and its policies.
3. (Optional) **Authentication → Providers → Email**: for the fastest testing,
   turn **off** "Confirm email" so new sign-ups can log in immediately. Leave it
   on for production (the app shows a "check your inbox" notice in that case).
4. **Project Settings → API**, copy:
   - **Project URL** → `EXPO_PUBLIC_SUPABASE_URL`
   - **anon public** key → `EXPO_PUBLIC_SUPABASE_ANON_KEY`

## 2. Mobile env

Create `mobile/.env` (copy from `mobile/.env.example`):

```
EXPO_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=YOUR-ANON-KEY
```

Restart Expo with a clear cache so it picks up the env: `npx expo start --clear`.
The anon key is meant to be public — RLS makes sure each user only sees their own data.

## 3. Backend on Railway

1. Push this repo to GitHub.
2. On https://railway.app → **New Project → Deploy from GitHub repo**, pick this
   repo and set the **root directory** to `backend`.
3. **Variables** → add `OPENAI_API_KEY`. (`PORT` is provided by Railway.)
4. Railway builds with Nixpacks and runs `npm start`; health check hits `/health`
   (see [`backend/railway.json`](backend/railway.json)).
5. Copy the generated public URL and put it in `mobile/.env`:
   ```
   EXPO_PUBLIC_API_URL=https://your-backend.up.railway.app
   ```
   In local dev you can skip this — the app auto-targets `:3001` on your machine.

## How it fits together

- **Auth**: email/password via Supabase (`AuthContext` + `AuthScreen`). The app is
  gated — no session → login screen.
- **Data**: the whole app state is stored as one JSON row per user in `app_state`
  (`storage/persist.ts`), cached locally in AsyncStorage for offline use. A brand
  new account starts from the seed (one cookbook, one default recipe).
- **Images**: on save, local photos upload to the `recipe-images` bucket under
  `<user-id>/...` and the recipe keeps the public URL (`lib/storage.ts`).
- **Backend**: only the OpenAI recipe extraction lives on Railway; it never sees
  user data.
