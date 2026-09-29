-- Company hiring subscriptions. Entitlements are written only by trusted Edge Functions.
create table if not exists public.skillora_company_subscriptions (
  company_id uuid primary key references public.skillora_companies(id) on delete cascade,
  provider text not null default 'razorpay',
  provider_subscription_id text not null unique,
  provider_plan_id text not null,
  status text not null default 'created',
  current_start timestamptz,
  current_end timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.skillora_company_subscriptions enable row level security;
grant all on public.skillora_company_subscriptions to service_role;
