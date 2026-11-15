-- Mentor notes and recording links are private to class participants until
-- the mentor publishes them and the class has ended.
create table if not exists public.mentor_class_notes (
  class_id uuid primary key references public.live_classes(id) on delete cascade,
  mentor_id uuid not null references auth.users(id) on delete cascade,
  notes text not null default '' check (char_length(notes) <= 12000),
  recording_url text not null default '' check (char_length(recording_url) <= 2048 and (recording_url = '' or recording_url ~ '^https://')),
  published boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.mentor_class_notes enable row level security;
drop policy if exists "mentors manage notes for own classes" on public.mentor_class_notes;
create policy "mentors manage notes for own classes" on public.mentor_class_notes
  for all to authenticated
  using (mentor_id = auth.uid() and exists (
    select 1 from public.live_classes c join public.mentor_accounts ma on ma.user_id = auth.uid()
    where c.id = class_id and c.instructor_id = auth.uid()
  ))
  with check (mentor_id = auth.uid() and exists (
    select 1 from public.live_classes c join public.mentor_accounts ma on ma.user_id = auth.uid()
    where c.id = class_id and c.instructor_id = auth.uid()
  ));

drop policy if exists "students read ended published class notes" on public.mentor_class_notes;
create policy "students read ended published class notes" on public.mentor_class_notes
  for select to authenticated using (
    published and exists (
      select 1 from public.live_classes c
      where c.id = class_id and c.published
        and c.starts_at + make_interval(mins => c.duration_minutes) <= now()
    ) and exists (
      select 1 from public.class_registrations r
      where r.class_id = mentor_class_notes.class_id and r.user_id = auth.uid()
    )
  );

grant select, insert, update, delete on public.mentor_class_notes to authenticated;
