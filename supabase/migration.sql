-- ============================================================
-- Safe-to-Save — Supabase migration
-- Run this in the Supabase SQL Editor
-- ============================================================
-- BEFORE running: in Supabase Dashboard > Authentication > Settings,
-- disable "Confirm email" so users can sign in immediately with
-- synthetic emails (username@safe-to-save.local).
-- ============================================================
-- AFTER running: edit js/supabase.js with your Supabase URL and anon key.
-- ============================================================

-- 1. Profiles table
create table profiles (
  id uuid references auth.users primary key,
  username text unique not null,
  created_at timestamptz default now()
);

alter table profiles enable row level security;

create policy "profiles_select_own" on profiles
  for select using (id = auth.uid());

create policy "profiles_insert_own" on profiles
  for insert with check (id = auth.uid());

create policy "profiles_update_own" on profiles
  for update using (id = auth.uid());

create policy "profiles_delete_own" on profiles
  for delete using (id = auth.uid());

-- 2. Settings table
create table settings (
  user_id uuid references auth.users primary key,
  runway_days int not null default 14,
  starting_daily_estimate numeric not null default 0
);

alter table settings enable row level security;

create policy "settings_select_own" on settings
  for select using (user_id = auth.uid());

create policy "settings_insert_own" on settings
  for insert with check (user_id = auth.uid());

create policy "settings_update_own" on settings
  for update using (user_id = auth.uid());

create policy "settings_delete_own" on settings
  for delete using (user_id = auth.uid());

-- 3. Transactions table
create table transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  amount numeric not null,
  category text,
  note text,
  occurred_on date not null default current_date,
  created_at timestamptz default now()
);

alter table transactions enable row level security;

create policy "transactions_select_own" on transactions
  for select using (user_id = auth.uid());

create policy "transactions_insert_own" on transactions
  for insert with check (user_id = auth.uid());

create policy "transactions_update_own" on transactions
  for update using (user_id = auth.uid());

create policy "transactions_delete_own" on transactions
  for delete using (user_id = auth.uid());

-- 4. Balance check-ins table
create table balance_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  balance numeric not null,
  avg_daily_spend numeric not null,
  floor_amount numeric not null,
  safe_to_save numeric not null,
  checked_at timestamptz default now()
);

alter table balance_checkins enable row level security;

create policy "balance_checkins_select_own" on balance_checkins
  for select using (user_id = auth.uid());

create policy "balance_checkins_insert_own" on balance_checkins
  for insert with check (user_id = auth.uid());

create policy "balance_checkins_update_own" on balance_checkins
  for update using (user_id = auth.uid());

create policy "balance_checkins_delete_own" on balance_checkins
  for delete using (user_id = auth.uid());

-- 5. Auto-create profile + settings on signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, username)
  values (new.id, new.raw_user_meta_data ->> 'username');

  insert into settings (user_id)
  values (new.id);

  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
