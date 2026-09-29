-- Paid access to Mentor and Live Classes; only trusted server functions may write entitlements.
create table if not exists public.memberships (
  user_id uuid primary key references auth.users(id) on delete cascade,
  provider text not null default 'razorpay',
  provider_subscription_id text not null unique,
  provider_plan_id text not null,
  status text not null default 'created',
  current_start timestamptz,
  current_end timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.memberships enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'memberships'
      and policyname = 'memberships own rows readable'
  ) then
    execute 'create policy "memberships own rows readable" on public.memberships for select to authenticated using (auth.uid() = user_id)';
  end if;
end $$;
grant select on public.memberships to authenticated;
grant all on public.memberships to service_role;
