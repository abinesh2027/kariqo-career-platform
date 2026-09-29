-- Mentor accounts can create and publish their own live classes.
create table if not exists public.mentor_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.mentor_accounts enable row level security;
drop policy if exists "mentor can read own account" on public.mentor_accounts;
create policy "mentor can read own account" on public.mentor_accounts
  for select to authenticated using (auth.uid() = user_id);
grant select on public.mentor_accounts to authenticated;

alter table public.live_classes
  add column if not exists instructor_id uuid references auth.users(id) on delete cascade;

drop policy if exists "mentors manage own classes" on public.live_classes;
create policy "mentors manage own classes" on public.live_classes
  for all to authenticated
  using (
    instructor_id = auth.uid()
    and exists (select 1 from public.mentor_accounts where user_id = auth.uid())
  )
  with check (
    instructor_id = auth.uid()
    and exists (select 1 from public.mentor_accounts where user_id = auth.uid())
  );

grant insert, update on public.live_classes to authenticated;

create or replace function public.handle_skillora_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles(id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  insert into public.preferences(user_id) values (new.id) on conflict (user_id) do nothing;
  if new.raw_user_meta_data ->> 'account_type' = 'mentor' then
    insert into public.mentor_accounts(user_id) values (new.id) on conflict (user_id) do nothing;
  end if;
  return new;
end;
$$;
