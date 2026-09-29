-- Career readiness application features: a private student job tracker and
-- mentor-only access to skill ratings for students on their class rosters.

create table if not exists public.skillvo_job_applications (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  source_key text not null check (char_length(source_key) between 1 and 240),
  job_title text not null check (char_length(job_title) between 1 and 200),
  company_name text not null default '' check (char_length(company_name) <= 160),
  apply_url text not null default '' check (char_length(apply_url) <= 2048 and (apply_url = '' or apply_url ~ '^https?://')),
  status text not null default 'saved' check (status in ('saved','applied','screening','interview','offer','rejected','withdrawn')),
  company_job_id uuid references public.skillora_company_jobs(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, source_key)
);

alter table public.skillvo_job_applications enable row level security;
grant select, insert, update, delete on public.skillvo_job_applications to authenticated;
drop policy if exists "students manage own job applications" on public.skillvo_job_applications;
create policy "students manage own job applications" on public.skillvo_job_applications
  for all to authenticated using (auth.uid() = student_id) with check (auth.uid() = student_id);
create index if not exists skillvo_job_applications_student_updated_idx
  on public.skillvo_job_applications (student_id, updated_at desc);

drop policy if exists "mentors read skills of their class students" on public.skills;
create policy "mentors read skills of their class students" on public.skills
  for select to authenticated using (
    exists (
      select 1 from public.class_registrations r
      join public.live_classes c on c.id = r.class_id
      join public.mentor_accounts m on m.user_id = auth.uid()
      where r.user_id = skills.user_id and c.instructor_id = auth.uid()
    )
  );
grant select (user_id, name, score) on public.skills to authenticated;
