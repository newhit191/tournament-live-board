-- 固定 GM 帳號 + 註冊主玩家自動贈送 20 星

begin;

-- 1) 指定 newhit191@gmail.com 永遠具備 admin 權限
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_has_admin boolean;
  v_email text := lower(coalesce(new.email, ''));
  v_role text;
begin
  select exists (
    select 1
    from public.accounts
    where role in ('gm', 'admin')
  ) into v_has_admin;

  v_role := case
    when v_email = 'newhit191@gmail.com' then 'admin'
    when v_has_admin then 'user'
    else 'admin'
  end;

  insert into public.accounts (id, display_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    v_role
  )
  on conflict (id) do update
    set role = case
      when excluded.role in ('gm', 'admin') then excluded.role
      else public.accounts.role
    end;

  return new;
end;
$$;

-- 確保指定 Email 現有帳號也升級為 admin
update public.accounts
set role = 'admin'
where id in (
  select id
  from auth.users
  where lower(email) = 'newhit191@gmail.com'
);

-- 2) 帳號建立時，自動建立主玩家並贈送 20 星（僅首位主玩家）
create or replace function public.bootstrap_account_player()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player_id uuid;
begin
  if exists (
    select 1
    from public.players
    where owner_account_id = new.id
      and is_child = false
  ) then
    return new;
  end if;

  insert into public.players (
    owner_account_id,
    family_id,
    display_name,
    is_child,
    is_active
  )
  values (
    new.id,
    new.id,
    coalesce(new.display_name, '玩家'),
    false,
    true
  )
  returning id into v_player_id;

  update public.player_wallets
  set balance = balance + 20
  where player_id = v_player_id;

  insert into public.wallet_ledger (
    player_id,
    movement,
    amount,
    event_type,
    reason,
    created_by_account_id
  )
  values (
    v_player_id,
    'credit',
    20,
    'signup_bonus',
    '註冊贈送 20 星',
    new.id
  );

  return new;
end;
$$;

drop trigger if exists trg_accounts_bootstrap_player on public.accounts;
create trigger trg_accounts_bootstrap_player
after insert on public.accounts
for each row execute function public.bootstrap_account_player();

-- 3) 補齊既有「沒有任何玩家」的帳號，並給註冊贈送星星
do $$
declare
  v_account record;
  v_player_id uuid;
begin
  for v_account in
    select a.id, a.display_name
    from public.accounts a
    where not exists (
      select 1
      from public.players p
      where p.owner_account_id = a.id
    )
  loop
    insert into public.players (
      owner_account_id,
      family_id,
      display_name,
      is_child,
      is_active
    )
    values (
      v_account.id,
      v_account.id,
      coalesce(v_account.display_name, '玩家'),
      false,
      true
    )
    returning id into v_player_id;

    update public.player_wallets
    set balance = balance + 20
    where player_id = v_player_id;

    insert into public.wallet_ledger (
      player_id,
      movement,
      amount,
      event_type,
      reason,
      created_by_account_id
    )
    values (
      v_player_id,
      'credit',
      20,
      'signup_bonus',
      '補發註冊贈送 20 星',
      v_account.id
    );
  end loop;
end $$;

commit;
