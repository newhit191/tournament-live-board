-- 第一位註冊使用者自動成為 admin（避免無人可進 GM 後台）

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_has_admin boolean;
begin
  select exists (
    select 1
    from public.accounts
    where role in ('gm', 'admin')
  ) into v_has_admin;

  insert into public.accounts (id, display_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    case when v_has_admin then 'user' else 'admin' end
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- 若目前尚無任何 gm/admin，補一位最早註冊帳號為 admin
do $$
declare
  v_has_admin boolean;
  v_first_account uuid;
begin
  select exists (
    select 1
    from public.accounts
    where role in ('gm', 'admin')
  ) into v_has_admin;

  if not v_has_admin then
    select id
    into v_first_account
    from public.accounts
    order by created_at asc
    limit 1;

    if v_first_account is not null then
      update public.accounts
      set role = 'admin'
      where id = v_first_account;
    end if;
  end if;
end $$;
