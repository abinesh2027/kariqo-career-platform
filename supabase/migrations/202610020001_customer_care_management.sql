alter table public.support_messages
  add column if not exists status text not null default 'open',
  add column if not exists staff_reply text,
  add column if not exists staff_replied_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

alter table public.support_messages
  drop constraint if exists support_messages_status_check;
alter table public.support_messages
  add constraint support_messages_status_check
  check (status in ('open', 'in_progress', 'resolved'));

drop policy if exists "support own rows" on public.support_messages;
drop policy if exists "students can read own support requests" on public.support_messages;
drop policy if exists "students can create own support requests" on public.support_messages;
create policy "students can read own support requests" on public.support_messages
  for select to authenticated using (auth.uid() = user_id);
create policy "students can create own support requests" on public.support_messages
  for insert to authenticated with check (auth.uid() = user_id);

revoke update, delete on public.support_messages from authenticated;
grant select, insert on public.support_messages to authenticated;
grant all on public.support_messages to service_role;
