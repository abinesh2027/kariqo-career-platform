-- Mentor class materials, assignments, student submissions, and private feedback.
create table if not exists public.mentor_class_materials (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.live_classes(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 160),
  url text not null check (char_length(url) <= 2048 and url ~ '^https?://'),
  resource_type text not null default 'link' check (resource_type in ('link','slides','video','reading','recording')),
  created_at timestamptz not null default now()
);

create table if not exists public.mentor_class_assignments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.live_classes(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 160),
  instructions text not null default '' check (char_length(instructions) <= 4000),
  due_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.mentor_assignment_submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.mentor_class_assignments(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  submission_text text not null default '' check (char_length(submission_text) <= 10000),
  submission_url text not null default '' check (char_length(submission_url) <= 2048 and (submission_url = '' or submission_url ~ '^https?://')),
  submitted_at timestamptz not null default now(),
  score numeric(5,2) check (score is null or score between 0 and 100),
  feedback text not null default '' check (char_length(feedback) <= 4000),
  reviewed_at timestamptz,
  unique (assignment_id, student_id)
);

alter table public.mentor_class_materials enable row level security;
alter table public.mentor_class_assignments enable row level security;
alter table public.mentor_assignment_submissions enable row level security;

grant select, insert, update, delete on public.mentor_class_materials, public.mentor_class_assignments to authenticated;
grant select on public.mentor_assignment_submissions to authenticated;
grant insert (assignment_id, student_id, submission_text, submission_url) on public.mentor_assignment_submissions to authenticated;

drop policy if exists "mentors manage materials for own classes" on public.mentor_class_materials;
create policy "mentors manage materials for own classes" on public.mentor_class_materials
 for all to authenticated using (exists (select 1 from public.live_classes c join public.mentor_accounts m on m.user_id=auth.uid() where c.id=class_id and c.instructor_id=auth.uid()))
 with check (exists (select 1 from public.live_classes c join public.mentor_accounts m on m.user_id=auth.uid() where c.id=class_id and c.instructor_id=auth.uid()));
create policy "students read materials for published classes" on public.mentor_class_materials
 for select to authenticated using (exists (select 1 from public.live_classes c where c.id=class_id and c.published));

drop policy if exists "mentors manage assignments for own classes" on public.mentor_class_assignments;
create policy "mentors manage assignments for own classes" on public.mentor_class_assignments
 for all to authenticated using (exists (select 1 from public.live_classes c join public.mentor_accounts m on m.user_id=auth.uid() where c.id=class_id and c.instructor_id=auth.uid()))
 with check (exists (select 1 from public.live_classes c join public.mentor_accounts m on m.user_id=auth.uid() where c.id=class_id and c.instructor_id=auth.uid()));
create policy "students read assignments for published classes" on public.mentor_class_assignments
 for select to authenticated using (exists (select 1 from public.live_classes c where c.id=class_id and c.published));

create policy "students read own assignment submissions" on public.mentor_assignment_submissions
 for select to authenticated using (student_id=auth.uid());
create policy "students submit assignments for registered classes" on public.mentor_assignment_submissions
 for insert to authenticated with check (
   student_id=auth.uid() and exists (
     select 1 from public.mentor_class_assignments a
     join public.live_classes c on c.id=a.class_id and c.published
     join public.class_registrations r on r.class_id=c.id and r.user_id=auth.uid()
     where a.id=assignment_id
   )
 );
create policy "mentors read submissions for own classes" on public.mentor_assignment_submissions
 for select to authenticated using (exists (
   select 1 from public.mentor_class_assignments a
   join public.live_classes c on c.id=a.class_id
   join public.mentor_accounts m on m.user_id=auth.uid()
   where a.id=assignment_id and c.instructor_id=auth.uid()
 ));
create policy "mentors review submissions for own classes" on public.mentor_assignment_submissions
 for update to authenticated using (exists (
   select 1 from public.mentor_class_assignments a
   join public.live_classes c on c.id=a.class_id
   join public.mentor_accounts m on m.user_id=auth.uid()
   where a.id=assignment_id and c.instructor_id=auth.uid()
 )) with check (exists (
   select 1 from public.mentor_class_assignments a
   join public.live_classes c on c.id=a.class_id
   join public.mentor_accounts m on m.user_id=auth.uid()
   where a.id=assignment_id and c.instructor_id=auth.uid()
 ));

create index if not exists mentor_materials_class_idx on public.mentor_class_materials(class_id,created_at desc);
create index if not exists mentor_assignments_class_idx on public.mentor_class_assignments(class_id,due_at);
create index if not exists mentor_submissions_assignment_idx on public.mentor_assignment_submissions(assignment_id,submitted_at desc);

-- Only a verified mentor for the assignment's class may grade and leave feedback.
create or replace function public.review_mentor_assignment_submission(
  p_submission_id uuid, p_score numeric, p_feedback text
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.mentor_assignment_submissions s
    join public.mentor_class_assignments a on a.id=s.assignment_id
    join public.live_classes c on c.id=a.class_id
    join public.mentor_accounts m on m.user_id=auth.uid()
    where s.id=p_submission_id and c.instructor_id=auth.uid()
  ) then
    raise exception 'You cannot review this submission';
  end if;
  if p_score is not null and (p_score < 0 or p_score > 100) then
    raise exception 'Score must be between 0 and 100';
  end if;
  update public.mentor_assignment_submissions
    set score=p_score, feedback=left(coalesce(p_feedback,''),4000), reviewed_at=now()
    where id=p_submission_id;
end;
$$;
revoke all on function public.review_mentor_assignment_submission(uuid,numeric,text) from public;
grant execute on function public.review_mentor_assignment_submission(uuid,numeric,text) to authenticated;
