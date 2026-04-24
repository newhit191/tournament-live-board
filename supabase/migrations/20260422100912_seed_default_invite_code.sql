insert into public.invite_codes (code, max_uses, note, is_active)
values ('BLADE-FRIEND-001', 20, '第一批朋友內測', true)
on conflict (code) do update
set
  max_uses = excluded.max_uses,
  note = excluded.note,
  is_active = excluded.is_active,
  updated_at = now();
