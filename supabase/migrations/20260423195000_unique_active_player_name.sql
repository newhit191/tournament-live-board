-- 玩家名稱唯一化（僅限制啟用中的玩家）

begin;

do $$
declare
  v_row record;
  v_new_name text;
  v_suffix integer;
begin
  for v_row in
    select
      p.id,
      p.display_name,
      row_number() over (
        partition by lower(trim(p.display_name))
        order by p.created_at asc, p.id asc
      ) as rn
    from public.players p
    where p.is_active = true
  loop
    if v_row.rn > 1 then
      v_suffix := v_row.rn;
      v_new_name := trim(v_row.display_name) || '_' || v_suffix::text;

      while exists (
        select 1
        from public.players x
        where x.id <> v_row.id
          and x.is_active = true
          and lower(trim(x.display_name)) = lower(trim(v_new_name))
      ) loop
        v_suffix := v_suffix + 1;
        v_new_name := trim(v_row.display_name) || '_' || v_suffix::text;
      end loop;

      update public.players
      set display_name = v_new_name
      where id = v_row.id;
    end if;
  end loop;
end $$;

create unique index if not exists ux_players_display_name_active
on public.players (lower(trim(display_name)))
where is_active = true;

commit;
