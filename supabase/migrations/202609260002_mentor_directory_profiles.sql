-- Let each authenticated mentor maintain a public directory profile.
alter table public.mentors
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create unique index if not exists mentors_user_id_unique
  on public.mentors(user_id);

drop policy if exists "mentors manage own directory profile" on public.mentors;
create policy "mentors manage own directory profile" on public.mentors
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant insert, update, delete on public.mentors to authenticated;
