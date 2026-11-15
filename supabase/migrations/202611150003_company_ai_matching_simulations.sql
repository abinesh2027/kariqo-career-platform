-- Company-authored work simulations connect role requirements to student evidence.
-- All employer reads/writes go through the authenticated company-dashboard function.
create table if not exists public.skillora_company_simulations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.skillora_companies(id) on delete cascade,
  job_id uuid not null references public.skillora_company_jobs(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 160),
  instructions text not null check (char_length(instructions) between 20 and 6000),
  expected_skills text[] not null default '{}',
  deadline timestamptz,
  status text not null default 'published' check (status in ('published','closed')),
  created_at timestamptz not null default now()
);

create table if not exists public.skillora_simulation_submissions (
  id uuid primary key default gen_random_uuid(),
  simulation_id uuid not null references public.skillora_company_simulations(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  answer text not null check (char_length(answer) between 20 and 8000),
  project_url text not null default '' check (project_url = '' or project_url ~ '^https?://'),
  status text not null default 'submitted' check (status in ('submitted','reviewing','shortlisted','not_selected')),
  score numeric(5,2) check (score is null or score between 0 and 100),
  feedback text not null default '' check (char_length(feedback) <= 4000),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  unique (simulation_id, student_id)
);

alter table public.skillora_company_simulations enable row level security;
alter table public.skillora_simulation_submissions enable row level security;
grant all on public.skillora_company_simulations, public.skillora_simulation_submissions to service_role;
create index if not exists skillora_company_simulations_open_idx on public.skillora_company_simulations(status, created_at desc);
create index if not exists skillora_simulation_submissions_company_idx on public.skillora_simulation_submissions(simulation_id, submitted_at desc);
create index if not exists skillora_simulation_submissions_student_idx on public.skillora_simulation_submissions(student_id, submitted_at desc);
