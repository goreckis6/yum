-- YumShare Supabase schema
-- Run this in the Supabase SQL editor (Dashboard → SQL → New query).
-- It is idempotent: safe to run more than once.

-- 1) Per-user app state (the whole AppState blob lives here as JSON).
create table if not exists public.app_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.app_state enable row level security;

-- Each user can read/write only their own row.
drop policy if exists "app_state_select_own" on public.app_state;
create policy "app_state_select_own" on public.app_state
  for select using (auth.uid() = user_id);

drop policy if exists "app_state_insert_own" on public.app_state;
create policy "app_state_insert_own" on public.app_state
  for insert with check (auth.uid() = user_id);

drop policy if exists "app_state_update_own" on public.app_state;
create policy "app_state_update_own" on public.app_state
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 1b) Optimistic-concurrency save for app_state. The whole state is one JSON
-- blob, so a naive upsert lets a device with stale data clobber a newer write
-- from another device. This function writes only when the server copy has not
-- advanced past what the caller last synced (p_base); on conflict it returns
-- the server's newer state so the client can adopt it instead of overwriting.
-- Uses auth.uid() internally (never a client-supplied id) so a caller can only
-- ever touch their own row, even though it is SECURITY DEFINER.
create or replace function public.save_app_state(p_data jsonb, p_base timestamptz)
returns table(updated_at timestamptz, data jsonb, conflict boolean)
language plpgsql security definer as $$
declare uid uuid := auth.uid(); cur_ts timestamptz; cur_data jsonb; new_ts timestamptz := now();
begin
  if uid is null then raise exception 'not authenticated'; end if;
  select a.updated_at, a.data into cur_ts, cur_data from public.app_state a where a.user_id = uid;
  -- Server has a strictly newer write than the caller's baseline → conflict.
  if cur_ts is not null and p_base is not null and cur_ts > p_base then
    return query select cur_ts, cur_data, true;
    return;
  end if;
  insert into public.app_state (user_id, data, updated_at)
    values (uid, p_data, new_ts)
    on conflict (user_id) do update set data = excluded.data, updated_at = new_ts;
  return query select new_ts, p_data, false;
end $$;

grant execute on function public.save_app_state(jsonb, timestamptz) to authenticated;

-- 2) Storage bucket for recipe / cookbook images.
insert into storage.buckets (id, name, public)
values ('recipe-images', 'recipe-images', true)
on conflict (id) do nothing;

-- Public read of images; authenticated users may only write under their own
-- folder ("<uid>/...").
drop policy if exists "recipe_images_public_read" on storage.objects;
create policy "recipe_images_public_read" on storage.objects
  for select using (bucket_id = 'recipe-images');

drop policy if exists "recipe_images_insert_own" on storage.objects;
create policy "recipe_images_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'recipe-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "recipe_images_update_own" on storage.objects;
create policy "recipe_images_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'recipe-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "recipe_images_delete_own" on storage.objects;
create policy "recipe_images_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'recipe-images' and (storage.foldername(name))[1] = auth.uid()::text);

-- 3) Apple refresh tokens — stored so the backend can revoke the user's Sign in
-- with Apple authorization on account deletion (App Store requirement). Only the
-- service role (backend) touches this table; no client access.
create table if not exists public.apple_tokens (
  user_id uuid primary key references auth.users (id) on delete cascade,
  refresh_token text not null,
  updated_at timestamptz not null default now()
);

alter table public.apple_tokens enable row level security;
-- No policies → RLS denies all anon/authenticated access; service role bypasses.

-- 4) Freemium import credits — every account starts with FREE_IMPORT_CREDITS
-- (20) free recipe extractions. Enforced server-side so it can't be bypassed by
-- a modified client. Only the service role (backend) touches this table.
create table if not exists public.user_credits (
  user_id uuid primary key references auth.users (id) on delete cascade,
  credits int not null default 20,
  updated_at timestamptz not null default now()
);

-- The table may already exist (created when the default was 10), and
-- `create table if not exists` won't change its default — so set it explicitly.
-- New accounts get 20 free imports from now on.
alter table public.user_credits alter column credits set default 20;

alter table public.user_credits enable row level security;
-- No policies → RLS denies all anon/authenticated access; service role bypasses.

-- Ensure a row exists and return the current balance.
create or replace function public.get_import_credits(p_user uuid)
returns int language plpgsql security definer as $$
declare remaining int;
begin
  insert into public.user_credits (user_id) values (p_user)
    on conflict (user_id) do nothing;
  select credits into remaining from public.user_credits where user_id = p_user;
  return coalesce(remaining, 0);
end $$;

-- Atomically spend one credit (never below 0) and return the new balance.
-- Atomic so parallel requests can't over-spend a single credit.
create or replace function public.spend_import_credit(p_user uuid)
returns int language plpgsql security definer as $$
declare remaining int;
begin
  insert into public.user_credits (user_id) values (p_user)
    on conflict (user_id) do nothing;
  update public.user_credits
    set credits = credits - 1, updated_at = now()
    where user_id = p_user and credits > 0
    returning credits into remaining;
  if remaining is null then
    select credits into remaining from public.user_credits where user_id = p_user;
  end if;
  return coalesce(remaining, 0);
end $$;

-- 5) Per-user daily API usage — a durable fair-use cap (survives deploys and
-- works across instances, unlike an in-memory counter). Premium users are
-- "unlimited" for total imports but still capped per day to stop abuse/scripts.
create table if not exists public.api_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  count int not null default 0,
  primary key (user_id, day)
);

alter table public.api_usage enable row level security;
-- No policies → only the service role (backend) can read/write.

-- Atomically record one more call for today and return the new daily count.
create or replace function public.bump_api_usage(p_user uuid)
returns int language plpgsql security definer as $$
declare c int;
begin
  insert into public.api_usage (user_id, day, count)
    values (p_user, current_date, 1)
    on conflict (user_id, day)
    do update set count = public.api_usage.count + 1
    returning count into c;
  return c;
end $$;
