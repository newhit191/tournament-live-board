-- 修正獎池賽名次寫入：
-- 1) 移除 rank_other 被寫成 999 的不合理名次
-- 2) 三人賽且未設定第三名獎勵時，仍可正確標示第 3 名

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
  v_participant_total integer := 0;
begin
  if v_uid is null then
    return false;
  end if;

  select *
  into v_challenge
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
     or (
       p_third_player_id is not null
       and (
         p_first_player_id = p_third_player_id
         or p_second_player_id = p_third_player_id
       )
     ) then
    return false;
  end if;

  if not exists (
    select 1
    from public.challenge_participants
    where challenge_id = p_challenge_id
      and player_id = p_first_player_id
  ) or not exists (
    select 1
    from public.challenge_participants
    where challenge_id = p_challenge_id
      and player_id = p_second_player_id
  ) then
    return false;
  end if;

  if v_challenge.reward_third > 0 and (
    p_third_player_id is null
    or not exists (
      select 1
      from public.challenge_participants
      where challenge_id = p_challenge_id
        and player_id = p_third_player_id
    )
  ) then
    return false;
  end if;

  select count(distinct p.family_id)
  into v_family_count
  from public.challenge_participants cp
  join public.players p on p.id = cp.player_id
  where cp.challenge_id = p_challenge_id;

  select count(*)
  into v_participant_total
  from public.challenge_participants
  where challenge_id = p_challenge_id;

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
        when p_third_player_id is null
          and v_participant_total = 3
          and player_id not in (p_first_player_id, p_second_player_id) then 3
        else null
      end,
      result = case
        when player_id = p_first_player_id then 'rank_1'
        when player_id = p_second_player_id then 'rank_2'
        when p_third_player_id is not null and player_id = p_third_player_id then 'rank_3'
        when p_third_player_id is null
          and v_participant_total = 3
          and player_id not in (p_first_player_id, p_second_player_id) then 'rank_3'
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

-- 舊資料清理：把過去寫入的 999 名次改為 null，避免前端誤顯示。
update public.challenge_participants
set final_rank = null
where result = 'rank_other'
  and final_rank = 999;
