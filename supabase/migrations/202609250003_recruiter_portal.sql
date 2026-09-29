-- Interview readiness, ATS resumes, and a consent-based employer portal.
alter table public.profiles
  add column if not exists learning_complete boolean not null default false,
  add column if not exists interview_ready boolean not null default false,
  add column if not exists recruiter_visible boolean not null default false,
  add column if not exists ats_resume_text text not null default '';

create table if not exists public.skillora_companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- Only project administrators provision approved company users.
create table if not exists public.skillora_company_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid not null references public.skillora_companies(id) on delete cascade,
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.skillora_company_jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.skillora_companies(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  title text not null check (char_length(title) between 3 and 120),
  description text not null default '' check (char_length(description) <= 4000),
  required_skills text[] not null default '{}',
  location text not null default '',
  job_type text not null default 'Full-time',
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now()
);

create table if not exists public.skillora_job_offers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.skillora_companies(id) on delete cascade,
  job_id uuid not null references public.skillora_company_jobs(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  match_score int not null check (match_score between 0 and 100),
  company_name text not null default '',
  job_title text not null default '',
  job_location text not null default '',
  status text not null default 'sent' check (status in ('sent', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  unique (job_id, student_id)
);

alter table public.skillora_companies enable row level security;
alter table public.skillora_company_accounts enable row level security;
alter table public.skillora_company_jobs enable row level security;
alter table public.skillora_job_offers enable row level security;

-- Company and job data are accessed only by the authenticated company-dashboard
-- Edge Function using the service role after it verifies approved membership.
grant all on public.skillora_companies, public.skillora_company_accounts,
  public.skillora_company_jobs, public.skillora_job_offers to service_role;

drop policy if exists "students read their company job offers" on public.skillora_job_offers;
create policy "students read their company job offers" on public.skillora_job_offers
  for select to authenticated using (auth.uid() = student_id);
grant select on public.skillora_job_offers to authenticated;

create index if not exists skillora_company_jobs_company_status_idx
  on public.skillora_company_jobs (company_id, status, created_at desc);
create index if not exists skillora_job_offers_student_created_idx
  on public.skillora_job_offers (student_id, created_at desc);
