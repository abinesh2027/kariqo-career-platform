-- Mentor attendance: mentors can read their own class rosters and mark attendance.
alter table public.class_registrations
  add column if not exists attendance_status text not null default 'not_marked',
  add column if not exists attended_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'class_registrations_attendance_status_check') then
    alter table public.class_registrations add constraint class_registrations_attendance_status_check
      check (attendance_status in ('not_marked', 'present', 'absent', 'late', 'excused'));
  end if;
end $$;

drop policy if exists "own class registrations" on public.class_registrations;
create policy "students read own class registrations" on public.class_registrations
  for select to authenticated using (auth.uid() = user_id);
create policy "students register for published classes" on public.class_registrations
  for insert to authenticated with check (
    auth.uid() = user_id and exists (
      select 1 from public.live_classes c where c.id = class_id and c.published
    )
  );
create policy "students cancel own class registrations" on public.class_registrations
  for delete to authenticated using (auth.uid() = user_id);
create policy "mentors read their class rosters" on public.class_registrations
  for select to authenticated using (
    exists (
      select 1 from public.live_classes c
      join public.mentor_accounts m on m.user_id = auth.uid()
      where c.id = class_id and c.instructor_id = auth.uid()
    )
  );
create policy "mentors mark attendance for own classes" on public.class_registrations
  for update to authenticated using (
    exists (
      select 1 from public.live_classes c
      join public.mentor_accounts m on m.user_id = auth.uid()
      where c.id = class_id and c.instructor_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.live_classes c
      join public.mentor_accounts m on m.user_id = auth.uid()
      where c.id = class_id and c.instructor_id = auth.uid()
    )
  );

revoke update on public.class_registrations from authenticated;
grant select, insert, delete on public.class_registrations to authenticated;
grant update (attendance_status, attended_at) on public.class_registrations to authenticated;

drop policy if exists "mentors can read names of class students" on public.profiles;
create policy "mentors can read names of class students" on public.profiles
  for select to authenticated using (
    exists (
      select 1 from public.class_registrations r
      join public.live_classes c on c.id = r.class_id
      join public.mentor_accounts m on m.user_id = auth.uid()
      where r.user_id = profiles.id and c.instructor_id = auth.uid()
    )
  );
grant select (id, full_name) on public.profiles to authenticated;

create index if not exists class_registrations_class_attendance_idx
  on public.class_registrations (class_id, attendance_status);
