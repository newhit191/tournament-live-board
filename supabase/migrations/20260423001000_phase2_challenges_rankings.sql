-- Phase 2: 約戰（單場對賭 / 獎池賽）+ 排行榜基礎

begin;

-- 1) 約戰主體
create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  mode text not null check (mode in ('single_stake', 'prize_pool')),
  title text not null,
  description text,
  city text,
  venue text,
  starts_at timestamptz,
  status text not null default 'open' check (status in ('open', 'in_progress', 'completed', 'cancelled')),
  created_by_account_id uuid not null references public.accounts(id) on delete restrict,
  host_player_id uuid not null references public.players(id) on delete restrict,
  participant_limit integer not null default 2 check (participant_limit >= 2 and participant_limit <= 128),
  entry_fee integer not null default 0 check (entry_fee >= 0),
  reward_first integer not null default 0 check (reward_first >= 0),
  reward_second integer not null default 0 check (reward_second >= 0),
  reward_third integer not null default 0 check (reward_third >= 0),
  is_practice boolean not null default false,
  counts_for_ranking boolean not null default true,
  cross_family boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_challenges_status_created_at on public.challenges(status, created_at desc);
create index if not exists idx_challenges_mode_status on public.challenges(mode, status);
create index if not exists idx_challenges_creator on public.challenges(created_by_account_id);

drop trigger if exists trg_challenges_updated_at on public.challenges;
create trigger trg_challenges_updated_at
before update on public.challenges
for each row execute function public.set_updated_at();

-- 2) 參戰者
create table if not exists public.challenge_participants (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete restrict,
  joined_by_account_id uuid not null references public.accounts(id) on delete restrict,
  is_host boolean not null default false,
  stake_offer integer not null default 0 check (stake_offer >= 0),
  locked_amount integer not null default 0 check (locked_amount >= 0),
  final_rank integer,
  result text not null default 'pending' check (
    result in ('pending', 'winner', 'loser', 'rank_1', 'rank_2', 'rank_3', 'rank_other', 'cancelled')
  ),
  created_at timestamptz not null default now(),
  unique (challenge_id, player_id)
);

create index if not exists idx_challenge_participants_challenge on public.challenge_participants(challenge_id, created_at asc);
create index if not exists idx_challenge_participants_player on public.challenge_participants(player_id, created_at desc);

-- 3) 單場紀錄
create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  player_a_id uuid not null references public.players(id) on delete restrict,
  player_b_id uuid not null references public.players(id) on delete restrict,
  winner_player_id uuid references public.players(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending', 'completed', 'cancelled')),
  notes text,
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_matches_challenge on public.matches(challenge_id, created_at desc);

drop trigger if exists trg_matches_updated_at on public.matches;
create trigger trg_matches_updated_at
before update on public.matches
for each row execute function public.set_updated_at();

-- 4) 對賭明細
create table if not exists public.match_stakes (
  id bigserial primary key,
  match_id uuid not null references public.matches(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete restrict,
  offered_amount integer not null check (offered_amount >= 0),
  final_locked_amount integer not null check (final_locked_amount >= 0),
  status text not null default 'locked' check (status in ('locked', 'settled', 'refunded')),
  created_at timestamptz not null default now(),
  unique (match_id, player_id)
);

create index if not exists idx_match_stakes_match on public.match_stakes(match_id);

-- 5) 稱號定義與玩家稱號
create table if not exists public.title_definitions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text not null,
  rule_kind text not null check (rule_kind in ('manual', 'max_balance', 'max_wins', 'max_cross_family_wins')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_title_definitions_updated_at on public.title_definitions;
create trigger trg_title_definitions_updated_at
before update on public.title_definitions
for each row execute function public.set_updated_at();

create table if not exists public.player_titles (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  title_definition_id uuid not null references public.title_definitions(id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  is_equipped boolean not null default false,
  unique (player_id, title_definition_id)
);

create index if not exists idx_player_titles_player on public.player_titles(player_id);

-- 6) helper: 判斷 GM/admin
create or replace function public.is_gm_or_admin(p_account_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.accounts
    where id = p_account_id
      and role in ('gm', 'admin')
  );
$$;

-- 7) 建立約戰 + 主辦者入場（同 transaction）
create or replace function public.create_challenge_with_host(
  p_mode text,
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
    v_lock_amount := p_host_stake;
    p_participant_limit := 2;
    p_entry_fee := 0;
    p_reward_first := 0;
    p_reward_second := 0;
    p_reward_third := 0;
  else
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

-- 8) 參加約戰 + 鎖星
create or replace function public.join_challenge(
  p_challenge_id uuid,
  p_player_id uuid,
  p_stake integer default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_challenge public.challenges%rowtype;
  v_owner_id uuid;
  v_existing_count integer;
  v_lock_amount integer := 0;
  v_balance integer;
  v_host_participant record;
  v_host_family uuid;
  v_join_family uuid;
  v_is_practice boolean := false;
begin
  if v_uid is null then
    return false;
  end if;

  select * into v_challenge
  from public.challenges
  where id = p_challenge_id
  for update;

  if not found or v_challenge.status <> 'open' then
    return false;
  end if;

  select owner_account_id, family_id into v_owner_id, v_join_family
  from public.players
  where id = p_player_id
    and is_active = true;

  if v_owner_id is null or v_owner_id <> v_uid then
    return false;
  end if;

  if exists (
    select 1
    from public.challenge_participants cp
    where cp.challenge_id = p_challenge_id
      and cp.player_id = p_player_id
  ) then
    return false;
  end if;

  select count(*) into v_existing_count
  from public.challenge_participants cp
  where cp.challenge_id = p_challenge_id;

  if v_existing_count >= v_challenge.participant_limit then
    return false;
  end if;

  if v_challenge.mode = 'single_stake' then
    if v_existing_count <> 1 then
      return false;
    end if;

    select cp.id, cp.player_id, cp.locked_amount, p.family_id
    into v_host_participant
    from public.challenge_participants cp
    join public.players p on p.id = cp.player_id
    where cp.challenge_id = p_challenge_id
      and cp.is_host = true
    limit 1;

    if v_host_participant.player_id is null then
      return false;
    end if;

    v_host_family := v_host_participant.family_id;
    v_is_practice := (v_host_family = v_join_family);

    if v_is_practice then
      v_lock_amount := 0;

      -- 同家庭練習賽：若主辦方先鎖了星星，這裡直接退回
      if coalesce(v_host_participant.locked_amount, 0) > 0 then
        update public.player_wallets
        set balance = balance + v_host_participant.locked_amount,
            locked_balance = locked_balance - v_host_participant.locked_amount
        where player_id = v_host_participant.player_id;

        update public.challenge_participants
        set locked_amount = 0
        where id = v_host_participant.id;

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
          v_host_participant.player_id,
          'unlock',
          v_host_participant.locked_amount,
          'challenge_practice_refund',
          p_challenge_id::text,
          '同家庭練習賽，自動退回主辦方鎖定星星',
          v_uid
        );
      end if;
    else
      v_lock_amount := greatest(coalesce(p_stake, 0), 0);
      if v_lock_amount <= 0 then
        return false;
      end if;
    end if;
  else
    v_lock_amount := v_challenge.entry_fee;
  end if;

  if v_lock_amount > 0 then
    select balance into v_balance
    from public.player_wallets
    where player_id = p_player_id
    for update;

    if v_balance is null or v_balance < v_lock_amount then
      return false;
    end if;

    update public.player_wallets
    set balance = balance - v_lock_amount,
        locked_balance = locked_balance + v_lock_amount
    where player_id = p_player_id;

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
      p_player_id,
      'lock',
      v_lock_amount,
      case when v_challenge.mode = 'single_stake' then 'challenge_stake_lock' else 'prize_pool_entry_lock' end,
      p_challenge_id::text,
      case when v_challenge.mode = 'single_stake' then '加入單場對賭' else '加入獎池賽' end,
      v_uid
    );
  end if;

  insert into public.challenge_participants (
    challenge_id,
    player_id,
    joined_by_account_id,
    is_host,
    stake_offer,
    locked_amount
  )
  values (
    p_challenge_id,
    p_player_id,
    v_uid,
    false,
    case when v_challenge.mode = 'single_stake' then coalesce(p_stake, 0) else v_challenge.entry_fee end,
    v_lock_amount
  );

  if v_challenge.mode = 'single_stake' then
    insert into public.matches (challenge_id, player_a_id, player_b_id, status)
    values (p_challenge_id, v_challenge.host_player_id, p_player_id, 'pending');

    insert into public.match_stakes (match_id, player_id, offered_amount, final_locked_amount)
    select m.id, cp.player_id, cp.stake_offer, cp.locked_amount
    from public.matches m
    join public.challenge_participants cp on cp.challenge_id = m.challenge_id
    where m.challenge_id = p_challenge_id
      and m.status = 'pending'
      and cp.challenge_id = p_challenge_id
    on conflict (match_id, player_id) do nothing;

    update public.challenges
    set status = 'in_progress',
        is_practice = v_is_practice,
        counts_for_ranking = not v_is_practice,
        cross_family = not v_is_practice
    where id = p_challenge_id;
  else
    if v_existing_count + 1 >= v_challenge.participant_limit then
      update public.challenges
      set status = 'in_progress'
      where id = p_challenge_id;
    end if;
  end if;

  return true;
end;
$$;

-- 9) 取消約戰（退回鎖定星星）
create or replace function public.cancel_challenge(
  p_challenge_id uuid,
  p_reason text default '主辦方取消約戰'
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_challenge public.challenges%rowtype;
  v_allowed boolean := false;
  v_participant record;
begin
  if v_uid is null then
    return false;
  end if;

  select * into v_challenge
  from public.challenges
  where id = p_challenge_id
  for update;

  if not found then
    return false;
  end if;

  if v_challenge.status in ('completed', 'cancelled') then
    return false;
  end if;

  v_allowed := (
    v_challenge.created_by_account_id = v_uid
    or public.is_gm_or_admin(v_uid)
  );

  if not v_allowed then
    return false;
  end if;

  for v_participant in
    select cp.player_id, cp.locked_amount
    from public.challenge_participants cp
    where cp.challenge_id = p_challenge_id
      and cp.locked_amount > 0
  loop
    update public.player_wallets
    set balance = balance + v_participant.locked_amount,
        locked_balance = locked_balance - v_participant.locked_amount
    where player_id = v_participant.player_id;

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
      v_participant.player_id,
      'unlock',
      v_participant.locked_amount,
      'challenge_cancel_refund',
      p_challenge_id::text,
      p_reason,
      v_uid
    );
  end loop;

  update public.challenge_participants
  set locked_amount = 0,
      result = 'cancelled'
  where challenge_id = p_challenge_id;

  update public.matches
  set status = 'cancelled',
      settled_at = now()
  where challenge_id = p_challenge_id
    and status = 'pending';

  update public.challenges
  set status = 'cancelled',
      completed_at = now()
  where id = p_challenge_id;

  return true;
end;
$$;

-- 10) 單場對賭結算
create or replace function public.settle_single_stake_challenge(
  p_challenge_id uuid,
  p_winner_player_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_challenge public.challenges%rowtype;
  v_allowed boolean := false;
  v_winner record;
  v_loser record;
begin
  if v_uid is null then
    return false;
  end if;

  select * into v_challenge
  from public.challenges
  where id = p_challenge_id
  for update;

  if not found
     or v_challenge.mode <> 'single_stake'
     or v_challenge.status = 'cancelled'
     or v_challenge.status = 'completed' then
    return false;
  end if;

  v_allowed := (
    v_challenge.created_by_account_id = v_uid
    or public.is_gm_or_admin(v_uid)
  );
  if not v_allowed then
    return false;
  end if;

  select cp.player_id, cp.locked_amount
  into v_winner
  from public.challenge_participants cp
  where cp.challenge_id = p_challenge_id
    and cp.player_id = p_winner_player_id;

  if v_winner.player_id is null then
    return false;
  end if;

  select cp.player_id, cp.locked_amount
  into v_loser
  from public.challenge_participants cp
  where cp.challenge_id = p_challenge_id
    and cp.player_id <> p_winner_player_id
  limit 1;

  if v_loser.player_id is null then
    return false;
  end if;

  -- 練習賽：只退鎖定，不轉移星星
  if v_challenge.is_practice then
    if v_winner.locked_amount > 0 then
      update public.player_wallets
      set balance = balance + v_winner.locked_amount,
          locked_balance = locked_balance - v_winner.locked_amount
      where player_id = v_winner.player_id;

      insert into public.wallet_ledger (
        player_id, movement, amount, event_type, event_ref, reason, created_by_account_id
      ) values (
        v_winner.player_id, 'unlock', v_winner.locked_amount, 'challenge_practice_refund',
        p_challenge_id::text, '同家庭練習賽結束退回鎖定', v_uid
      );
    end if;

    if v_loser.locked_amount > 0 then
      update public.player_wallets
      set balance = balance + v_loser.locked_amount,
          locked_balance = locked_balance - v_loser.locked_amount
      where player_id = v_loser.player_id;

      insert into public.wallet_ledger (
        player_id, movement, amount, event_type, event_ref, reason, created_by_account_id
      ) values (
        v_loser.player_id, 'unlock', v_loser.locked_amount, 'challenge_practice_refund',
        p_challenge_id::text, '同家庭練習賽結束退回鎖定', v_uid
      );
    end if;
  else
    -- 勝方先拿回自己的鎖定
    if v_winner.locked_amount > 0 then
      update public.player_wallets
      set balance = balance + v_winner.locked_amount,
          locked_balance = locked_balance - v_winner.locked_amount
      where player_id = v_winner.player_id;

      insert into public.wallet_ledger (
        player_id, movement, amount, event_type, event_ref, reason, created_by_account_id
      ) values (
        v_winner.player_id, 'unlock', v_winner.locked_amount, 'challenge_stake_release',
        p_challenge_id::text, '單場對賭結算，取回己方鎖定', v_uid
      );
    end if;

    -- 敗方鎖定轉入勝方
    if v_loser.locked_amount > 0 then
      update public.player_wallets
      set locked_balance = locked_balance - v_loser.locked_amount
      where player_id = v_loser.player_id;

      update public.player_wallets
      set balance = balance + v_loser.locked_amount
      where player_id = v_winner.player_id;

      insert into public.wallet_ledger (
        player_id, counterparty_player_id, movement, amount, event_type, event_ref, reason, created_by_account_id
      ) values
      (
        v_loser.player_id, v_winner.player_id, 'debit', v_loser.locked_amount, 'challenge_stake_loss',
        p_challenge_id::text, '單場對賭敗方扣除鎖定星星', v_uid
      ),
      (
        v_winner.player_id, v_loser.player_id, 'credit', v_loser.locked_amount, 'challenge_stake_win',
        p_challenge_id::text, '單場對賭勝方獲得對手星星', v_uid
      );
    end if;
  end if;

  update public.challenge_participants
  set locked_amount = 0,
      result = case when player_id = p_winner_player_id then 'winner' else 'loser' end,
      final_rank = case when player_id = p_winner_player_id then 1 else 2 end
  where challenge_id = p_challenge_id;

  update public.matches
  set status = 'completed',
      winner_player_id = p_winner_player_id,
      settled_at = now()
  where challenge_id = p_challenge_id;

  update public.match_stakes
  set status = case
    when v_challenge.is_practice then 'refunded'
    else 'settled'
  end
  where match_id in (
    select m.id from public.matches m where m.challenge_id = p_challenge_id
  );

  update public.challenges
  set status = 'completed',
      completed_at = now()
  where id = p_challenge_id;

  return true;
end;
$$;

-- 11) 獎池賽結算（前三名固定星星）
create or replace function public.settle_prize_pool_challenge(
  p_challenge_id uuid,
  p_first_player_id uuid,
  p_second_player_id uuid,
  p_third_player_id uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_challenge public.challenges%rowtype;
  v_allowed boolean := false;
  v_reward integer;
  v_participant record;
  v_family_count integer := 0;
begin
  if v_uid is null then
    return false;
  end if;

  select * into v_challenge
  from public.challenges
  where id = p_challenge_id
  for update;

  if not found
     or v_challenge.mode <> 'prize_pool'
     or v_challenge.status in ('completed', 'cancelled') then
    return false;
  end if;

  v_allowed := (
    v_challenge.created_by_account_id = v_uid
    or public.is_gm_or_admin(v_uid)
  );
  if not v_allowed then
    return false;
  end if;

  if p_first_player_id = p_second_player_id
     or (p_third_player_id is not null and (p_first_player_id = p_third_player_id or p_second_player_id = p_third_player_id)) then
    return false;
  end if;

  if not exists (
    select 1 from public.challenge_participants where challenge_id = p_challenge_id and player_id = p_first_player_id
  ) or not exists (
    select 1 from public.challenge_participants where challenge_id = p_challenge_id and player_id = p_second_player_id
  ) then
    return false;
  end if;

  if v_challenge.reward_third > 0 and (
    p_third_player_id is null
    or not exists (
      select 1 from public.challenge_participants where challenge_id = p_challenge_id and player_id = p_third_player_id
    )
  ) then
    return false;
  end if;

  select count(distinct p.family_id)
  into v_family_count
  from public.challenge_participants cp
  join public.players p on p.id = cp.player_id
  where cp.challenge_id = p_challenge_id;

  for v_participant in
    select cp.player_id, cp.locked_amount
    from public.challenge_participants cp
    where cp.challenge_id = p_challenge_id
  loop
    v_reward := case
      when v_participant.player_id = p_first_player_id then v_challenge.reward_first
      when v_participant.player_id = p_second_player_id then v_challenge.reward_second
      when p_third_player_id is not null and v_participant.player_id = p_third_player_id then v_challenge.reward_third
      else 0
    end;

    if v_participant.locked_amount > 0 then
      update public.player_wallets
      set locked_balance = locked_balance - v_participant.locked_amount
      where player_id = v_participant.player_id;

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
        v_participant.player_id,
        'debit',
        v_participant.locked_amount,
        'prize_pool_entry_settled',
        p_challenge_id::text,
        '獎池賽結算，參賽費轉入獎池',
        v_uid
      );
    end if;

    if v_reward > 0 then
      update public.player_wallets
      set balance = balance + v_reward
      where player_id = v_participant.player_id;

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
        v_participant.player_id,
        'credit',
        v_reward,
        'prize_pool_reward',
        p_challenge_id::text,
        '獎池賽完賽發放名次獎勵',
        v_uid
      );
    end if;
  end loop;

  update public.challenge_participants
  set locked_amount = 0,
      final_rank = case
        when player_id = p_first_player_id then 1
        when player_id = p_second_player_id then 2
        when p_third_player_id is not null and player_id = p_third_player_id then 3
        else coalesce(final_rank, 999)
      end,
      result = case
        when player_id = p_first_player_id then 'rank_1'
        when player_id = p_second_player_id then 'rank_2'
        when p_third_player_id is not null and player_id = p_third_player_id then 'rank_3'
        else 'rank_other'
      end
  where challenge_id = p_challenge_id;

  update public.challenges
  set status = 'completed',
      completed_at = now(),
      is_practice = false,
      counts_for_ranking = true,
      cross_family = (v_family_count > 1)
  where id = p_challenge_id;

  return true;
end;
$$;

-- 12) RLS for phase 2 tables
alter table public.challenges enable row level security;
alter table public.challenge_participants enable row level security;
alter table public.matches enable row level security;
alter table public.match_stakes enable row level security;
alter table public.title_definitions enable row level security;
alter table public.player_titles enable row level security;

drop policy if exists "challenges_select_authenticated" on public.challenges;
create policy "challenges_select_authenticated"
on public.challenges
for select
to authenticated
using (true);

drop policy if exists "challenges_insert_creator" on public.challenges;
create policy "challenges_insert_creator"
on public.challenges
for insert
to authenticated
with check (created_by_account_id = auth.uid());

drop policy if exists "challenges_update_creator_or_gm" on public.challenges;
create policy "challenges_update_creator_or_gm"
on public.challenges
for update
to authenticated
using (
  created_by_account_id = auth.uid()
  or public.is_gm_or_admin(auth.uid())
)
with check (
  created_by_account_id = auth.uid()
  or public.is_gm_or_admin(auth.uid())
);

drop policy if exists "challenge_participants_select_authenticated" on public.challenge_participants;
create policy "challenge_participants_select_authenticated"
on public.challenge_participants
for select
to authenticated
using (true);

drop policy if exists "challenge_participants_insert_joiner" on public.challenge_participants;
create policy "challenge_participants_insert_joiner"
on public.challenge_participants
for insert
to authenticated
with check (joined_by_account_id = auth.uid());

drop policy if exists "matches_select_authenticated" on public.matches;
create policy "matches_select_authenticated"
on public.matches
for select
to authenticated
using (true);

drop policy if exists "match_stakes_select_authenticated" on public.match_stakes;
create policy "match_stakes_select_authenticated"
on public.match_stakes
for select
to authenticated
using (true);

drop policy if exists "title_definitions_select_authenticated" on public.title_definitions;
create policy "title_definitions_select_authenticated"
on public.title_definitions
for select
to authenticated
using (is_active = true);

drop policy if exists "player_titles_select_own_player" on public.player_titles;
create policy "player_titles_select_own_player"
on public.player_titles
for select
to authenticated
using (
  exists (
    select 1
    from public.players p
    where p.id = player_titles.player_id
      and p.owner_account_id = auth.uid()
  )
);

-- 13) 稱號預設資料
insert into public.title_definitions (code, name, description, rule_kind)
values
  ('rookie', '陀螺練習生', '新加入的玩家，正在累積第一批實戰經驗。', 'manual'),
  ('star_king', '星星霸主', '目前可用星星最高的玩家。', 'max_balance'),
  ('win_lord', '勝場統治者', '目前總勝場數最高的玩家。', 'max_wins'),
  ('cross_family_ace', '跨家族王者', '跨家庭正式賽勝場最高的玩家。', 'max_cross_family_wins')
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  rule_kind = excluded.rule_kind,
  is_active = true;

grant execute on function public.create_challenge_with_host(
  text, text, uuid, text, text, text, timestamptz, integer, integer, integer, integer, integer, integer
) to authenticated;

grant execute on function public.join_challenge(uuid, uuid, integer) to authenticated;
grant execute on function public.cancel_challenge(uuid, text) to authenticated;
grant execute on function public.settle_single_stake_challenge(uuid, uuid) to authenticated;
grant execute on function public.settle_prize_pool_challenge(uuid, uuid, uuid, uuid) to authenticated;

commit;
