create table if not exists public.skillvo_interview_practice (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  practice_date date not null,
  career_goal text not null default '',
  answers jsonb not null default '{}'::jsonb check (jsonb_typeof(answers) = 'object'),
  score integer not null check (score between 0 and 100),
  completed_at timestamptz not null default now(),
  unique (user_id, practice_date)
);
alter table public.skillvo_interview_practice enable row level security;
drop policy if exists "students manage own private interview practice" on public.skillvo_interview_practice;
create policy "students manage own private interview practice" on public.skillvo_interview_practice
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update, delete on public.skillvo_interview_practice to authenticated;
create index if not exists skillvo_interview_practice_user_date_idx
  on public.skillvo_interview_practice (user_id, practice_date desc);
