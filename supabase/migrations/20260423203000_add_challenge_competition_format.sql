-- 多人獎池補上賽制欄位（先記錄，下一階段串接賽程引擎）

alter table public.challenges
  add column if not exists competition_format text;

update public.challenges
set competition_format = case
  when mode = 'single_stake' then 'single_match'
  else 'manual_pool'
end
where competition_format is null;

alter table public.challenges
  alter column competition_format set default 'single_match';

alter table public.challenges
  alter column competition_format set not null;

alter table public.challenges
  drop constraint if exists challenges_competition_format_check;

alter table public.challenges
  add constraint challenges_competition_format_check
  check (
    competition_format in (
      'single_match',
      'manual_pool',
      'single_elimination',
      'double_elimination',
      'round_robin'
    )
  );

drop function if exists public.create_challenge_with_host(
  text,
  text,
  uuid,
  text,
  text,
  text,
  timestamptz,
  integer,
  integer,
  integer,
  integer,
  integer,
  integer
);

create or replace function public.create_challenge_with_host(
  p_mode text,
  p_competition_format text,
  p_title text,
  p_host_player_id uuid,
  p_description text default null,
  p_city text default null,
  p_venue text default null,
  p_starts_at timestamptz default null,
  p_host_stake integer default 0,
  p_participant_limit integer default 2,
  p_entry_fee integer default 0,
  p_reward_first integer default 0,
  p_reward_second integer default 0,
  p_reward_third integer default 0
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_challenge_id uuid;
  v_owner_id uuid;
  v_lock_amount integer := 0;
  v_balance integer;
  v_pool integer;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  if p_mode not in ('single_stake', 'prize_pool') then
    raise exception 'UNSUPPORTED_MODE';
  end if;

  select owner_account_id into v_owner_id
  from public.players
  where id = p_host_player_id
    and is_active = true;

  if v_owner_id is null or v_owner_id <> v_uid then
    raise exception 'HOST_PLAYER_NOT_ALLOWED';
  end if;

  if p_mode = 'single_stake' then
    if p_host_stake < 0 then
      raise exception 'INVALID_HOST_STAKE';
    end if;

    p_competition_format := 'single_match';
    v_lock_amount := p_host_stake;
    p_participant_limit := 2;
    p_entry_fee := 0;
    p_reward_first := 0;
    p_reward_second := 0;
    p_reward_third := 0;
  else
    if p_competition_format not in ('manual_pool', 'single_elimination', 'double_elimination', 'round_robin') then
      raise exception 'UNSUPPORTED_COMPETITION_FORMAT';
    end if;

    if p_participant_limit < 3 then
      raise exception 'PRIZE_POOL_PARTICIPANT_LIMIT_TOO_LOW';
    end if;

    if p_entry_fee <= 0 then
      raise exception 'PRIZE_POOL_ENTRY_FEE_REQUIRED';
    end if;

    v_pool := p_participant_limit * p_entry_fee;
    if p_reward_first + p_reward_second + p_reward_third <> v_pool then
      raise exception 'PRIZE_DISTRIBUTION_NOT_MATCH_POOL';
    end if;

    v_lock_amount := p_entry_fee;
  end if;

  if v_lock_amount > 0 then
    select balance into v_balance
    from public.player_wallets
    where player_id = p_host_player_id
    for update;

    if v_balance is null or v_balance < v_lock_amount then
      raise exception 'INSUFFICIENT_BALANCE';
    end if;

    update public.player_wallets
    set balance = balance - v_lock_amount,
        locked_balance = locked_balance + v_lock_amount
    where player_id = p_host_player_id;
  end if;

  insert into public.challenges (
    mode,
    competition_format,
    title,
    description,
    city,
    venue,
    starts_at,
    status,
    created_by_account_id,
    host_player_id,
    participant_limit,
    entry_fee,
    reward_first,
    reward_second,
    reward_third
  )
  values (
    p_mode,
    p_competition_format,
    p_title,
    p_description,
    p_city,
    p_venue,
    p_starts_at,
    'open',
    v_uid,
    p_host_player_id,
    p_participant_limit,
    p_entry_fee,
    p_reward_first,
    p_reward_second,
    p_reward_third
  )
  returning id into v_challenge_id;

  insert into public.challenge_participants (
    challenge_id,
    player_id,
    joined_by_account_id,
    is_host,
    stake_offer,
    locked_amount
  )
  values (
    v_challenge_id,
    p_host_player_id,
    v_uid,
    true,
    case when p_mode = 'single_stake' then p_host_stake else p_entry_fee end,
    v_lock_amount
  );

  if v_lock_amount > 0 then
    insert into public.wallet_ledger (
      player_id,
      movement,
      amount,
      event_type,
      event_ref,
      reason,
      created_by_account_id
    )
    values (
      p_host_player_id,
      'lock',
      v_lock_amount,
      case when p_mode = 'single_stake' then 'challenge_stake_lock' else 'prize_pool_entry_lock' end,
      v_challenge_id::text,
      case when p_mode = 'single_stake' then '建立單場對賭' else '建立獎池賽鎖定報名費' end,
      v_uid
    );
  end if;

  return v_challenge_id;
end;
$$;

grant execute on function public.create_challenge_with_host(
  text,
  text,
  text,
  uuid,
  text,
  text,
  text,
  timestamptz,
  integer,
  integer,
  integer,
  integer,
  integer,
  integer
) to authenticated;
