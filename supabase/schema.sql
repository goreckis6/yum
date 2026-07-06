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
