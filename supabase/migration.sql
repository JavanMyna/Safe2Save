-- ============================================================
-- Safe-to-Save — Supabase migration
-- Run this in the Supabase SQL Editor
-- ============================================================
-- BEFORE running: in Supabase Dashboard > Authentication > Settings,
-- disable "Confirm email" so users can sign in immediately with
-- synthetic emails (username@safe-to-save.local).
-- ============================================================
-- AFTER running: edit js/supabase.js with your Supabase URL and anon key.
--
-- Run this after the initial migration to add new columns:
--   alter table settings add column if not exists custom_categories jsonb default '[]'::jsonb;
-- Phase 2: add type column for income/expense tracking
--   alter table transactions add column type text not null default 'expense' check (type in ('expense','income'));
-- Phase 3: recurring transactions + budget pace
--   alter table settings add column monthly_budget numeric;
-- Phase 4: recurring link + future projections
--   alter table transactions add column recurring_transaction_id uuid references recurring_transactions(id);
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
-- NOTE: This trigger is a safety net. The client also creates
-- these rows manually after signUp. If the trigger fails for any
-- reason (metadata not yet available etc.), the client handles it.
create or replace function handle_new_user()
returns trigger as $$
begin
  begin
    insert into profiles (id, username)
    values (new.id, coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)));
  exception when others then
    -- client will create the row manually; ignore trigger failures
  end;

  begin
    insert into settings (user_id) values (new.id);
  exception when others then
  end;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- 6. Recurring transactions table
create table recurring_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  amount numeric not null,
  type text not null default 'expense' check (type in ('expense', 'income')),
  category text,
  note text,
  frequency text not null check (frequency in ('daily', 'weekly', 'monthly')),
  day_of_week int,
  day_of_month int,
  start_date date not null,
  next_occurrence date not null,
  active boolean not null default true,
  created_at timestamptz default now()
);

alter table recurring_transactions enable row level security;

create policy "recurring_select_own" on recurring_transactions for select using (user_id = auth.uid());
create policy "recurring_insert_own" on recurring_transactions for insert with check (user_id = auth.uid());
create policy "recurring_update_own" on recurring_transactions for update using (user_id = auth.uid());
create policy "recurring_delete_own" on recurring_transactions for delete using (user_id = auth.uid());
