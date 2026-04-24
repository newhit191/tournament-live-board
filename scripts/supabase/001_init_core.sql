-- Beyblade 平台 v1 - Core Schema
-- 執行位置：Supabase SQL Editor
-- 注意：請使用專案擁有者權限執行

begin;

create extension if not exists pgcrypto;

-- 1) 邀請碼
create table if not exists public.invite_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  max_uses integer not null default 1 check (max_uses > 0),
  used_count integer not null default 0 check (used_count >= 0),
  expires_at timestamptz,
  is_active boolean not null default true,
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_invite_codes_active on public.invite_codes(is_active, expires_at);

-- 2) 帳號（可登入主體）
create table if not exists public.accounts (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text not null default 'user' check (role in ('user', 'gm', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3) 玩家（出賽主體）
create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  owner_account_id uuid not null references public.accounts(id) on delete cascade,
  family_id uuid not null,
  display_name text not null,
  is_child boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_players_owner on public.players(owner_account_id);
create index if not exists idx_players_family on public.players(family_id);

-- 4) 玩家錢包（星星）
create table if not exists public.player_wallets (
  player_id uuid primary key references public.players(id) on delete cascade,
  balance integer not null default 0 check (balance >= 0),
  locked_balance integer not null default 0 check (locked_balance >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 5) 不可逆帳本
create table if not exists public.wallet_ledger (
  id bigserial primary key,
  player_id uuid not null references public.players(id) on delete restrict,
  counterparty_player_id uuid references public.players(id) on delete restrict,
  movement text not null check (movement in ('credit', 'debit', 'lock', 'unlock', 'adjust')),
  amount integer not null check (amount > 0),
  event_type text not null,
  event_ref text,
  reason text,
  created_by_account_id uuid references public.accounts(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_wallet_ledger_player on public.wallet_ledger(player_id, created_at desc);

-- 通用 updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_invite_codes_updated_at on public.invite_codes;
create trigger trg_invite_codes_updated_at
before update on public.invite_codes
for each row execute function public.set_updated_at();

drop trigger if exists trg_accounts_updated_at on public.accounts;
create trigger trg_accounts_updated_at
before update on public.accounts
for each row execute function public.set_updated_at();

drop trigger if exists trg_players_updated_at on public.players;
create trigger trg_players_updated_at
before update on public.players
for each row execute function public.set_updated_at();

drop trigger if exists trg_player_wallets_updated_at on public.player_wallets;
create trigger trg_player_wallets_updated_at
before update on public.player_wallets
for each row execute function public.set_updated_at();

-- auth.users 新增時自動建立 account
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.accounts (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

-- 玩家建立時自動給 family_id（預設 = owner_account_id）
create or replace function public.populate_player_family_id()
returns trigger
language plpgsql
as $$
begin
  if new.family_id is null then
    new.family_id := new.owner_account_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_players_family on public.players;
create trigger trg_players_family
before insert on public.players
for each row execute function public.populate_player_family_id();

-- 玩家建立時自動建錢包
create or replace function public.create_wallet_for_player()
returns trigger
language plpgsql
as $$
begin
  insert into public.player_wallets (player_id)
  values (new.id)
  on conflict (player_id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_players_create_wallet on public.players;
create trigger trg_players_create_wallet
after insert on public.players
for each row execute function public.create_wallet_for_player();

-- 邀請碼核銷（提供 App 呼叫）
create or replace function public.consume_invite_code(p_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row_count integer;
begin
  update public.invite_codes
  set used_count = used_count + 1
  where code = p_code
    and is_active = true
    and (expires_at is null or expires_at > now())
    and used_count < max_uses;

  get diagnostics v_row_count = row_count;
  return v_row_count = 1;
end;
$$;

-- RLS
alter table public.invite_codes enable row level security;
alter table public.accounts enable row level security;
alter table public.players enable row level security;
alter table public.player_wallets enable row level security;
alter table public.wallet_ledger enable row level security;

-- accounts
drop policy if exists "accounts_select_own" on public.accounts;
create policy "accounts_select_own"
on public.accounts
for select
to authenticated
using (id = auth.uid());

drop policy if exists "accounts_update_own" on public.accounts;
create policy "accounts_update_own"
on public.accounts
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- players
drop policy if exists "players_select_own_family" on public.players;
create policy "players_select_own_family"
on public.players
for select
to authenticated
using (owner_account_id = auth.uid());

drop policy if exists "players_insert_own" on public.players;
create policy "players_insert_own"
on public.players
for insert
to authenticated
with check (owner_account_id = auth.uid());

drop policy if exists "players_update_own" on public.players;
create policy "players_update_own"
on public.players
for update
to authenticated
using (owner_account_id = auth.uid())
with check (owner_account_id = auth.uid());

-- wallets
drop policy if exists "wallets_select_own_players" on public.player_wallets;
create policy "wallets_select_own_players"
on public.player_wallets
for select
to authenticated
using (
  exists (
    select 1
    from public.players p
    where p.id = player_wallets.player_id
      and p.owner_account_id = auth.uid()
  )
);

-- ledger
drop policy if exists "ledger_select_own_players" on public.wallet_ledger;
create policy "ledger_select_own_players"
on public.wallet_ledger
for select
to authenticated
using (
  exists (
    select 1
    from public.players p
    where p.id = wallet_ledger.player_id
      and p.owner_account_id = auth.uid()
  )
);

-- invite_codes: 一般使用者不直接可讀寫，僅透過 RPC / server action
drop policy if exists "invite_codes_no_direct_access" on public.invite_codes;
create policy "invite_codes_no_direct_access"
on public.invite_codes
for all
to authenticated
using (false)
with check (false);

commit;
