-- 家庭星星互轉與 GM 補星 RPC

create or replace function public.transfer_family_stars(
  p_from_player_id uuid,
  p_to_player_id uuid,
  p_amount integer,
  p_reason text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_from_owner uuid;
  v_to_owner uuid;
  v_available integer;
begin
  if v_uid is null then
    return false;
  end if;

  if p_amount <= 0 or p_from_player_id = p_to_player_id then
    return false;
  end if;

  select owner_account_id into v_from_owner
  from public.players
  where id = p_from_player_id;

  select owner_account_id into v_to_owner
  from public.players
  where id = p_to_player_id;

  if v_from_owner is null or v_to_owner is null then
    return false;
  end if;

  if v_from_owner <> v_uid or v_to_owner <> v_uid then
    return false;
  end if;

  select balance into v_available
  from public.player_wallets
  where player_id = p_from_player_id
  for update;

  if v_available is null or v_available < p_amount then
    return false;
  end if;

  update public.player_wallets
  set balance = balance - p_amount
  where player_id = p_from_player_id;

  update public.player_wallets
  set balance = balance + p_amount
  where player_id = p_to_player_id;

  insert into public.wallet_ledger (
    player_id,
    counterparty_player_id,
    movement,
    amount,
    event_type,
    reason,
    created_by_account_id
  ) values
    (
      p_from_player_id,
      p_to_player_id,
      'debit',
      p_amount,
      'family_transfer',
      coalesce(p_reason, '家庭內轉帳'),
      v_uid
    ),
    (
      p_to_player_id,
      p_from_player_id,
      'credit',
      p_amount,
      'family_transfer',
      coalesce(p_reason, '家庭內轉帳'),
      v_uid
    );

  return true;
end;
$$;

create or replace function public.gm_adjust_player_stars(
  p_target_player_id uuid,
  p_delta integer,
  p_reason text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_balance integer;
begin
  if v_uid is null then
    return false;
  end if;

  if p_delta = 0 then
    return false;
  end if;

  select role into v_role
  from public.accounts
  where id = v_uid;

  if v_role not in ('gm', 'admin') then
    return false;
  end if;

  select balance into v_balance
  from public.player_wallets
  where player_id = p_target_player_id
  for update;

  if v_balance is null then
    return false;
  end if;

  if p_delta < 0 and v_balance < abs(p_delta) then
    return false;
  end if;

  update public.player_wallets
  set balance = balance + p_delta
  where player_id = p_target_player_id;

  insert into public.wallet_ledger (
    player_id,
    movement,
    amount,
    event_type,
    reason,
    created_by_account_id
  )
  values (
    p_target_player_id,
    case when p_delta > 0 then 'credit' else 'debit' end,
    abs(p_delta),
    'gm_adjust',
    p_reason,
    v_uid
  );

  return true;
end;
$$;
