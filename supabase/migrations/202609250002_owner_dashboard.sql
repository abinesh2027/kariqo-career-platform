-- Only project administrators may read the cross-account management data.
create table if not exists public.skillora_owner_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.skillora_owner_accounts enable row level security;
drop policy if exists "owners can read own access" on public.skillora_owner_accounts;
create policy "owners can read own access" on public.skillora_owner_accounts
  for select to authenticated using (auth.uid() = user_id);
grant select on public.skillora_owner_accounts to authenticated;
grant all on public.skillora_owner_accounts to service_role;

drop policy if exists "owners can read all profiles" on public.profiles;
create policy "owners can read all profiles" on public.profiles
  for select to authenticated using (
    exists (select 1 from public.skillora_owner_accounts where user_id = auth.uid())
  );

drop policy if exists "owners can read all memberships" on public.memberships;
create policy "owners can read all memberships" on public.memberships
  for select to authenticated using (
    exists (select 1 from public.skillora_owner_accounts where user_id = auth.uid())
  );
