-- Store the secure conference link mentors share with registered students.
alter table public.live_classes
  add column if not exists meeting_url text not null default '';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'live_classes_meeting_url_https_check'
      and conrelid = 'public.live_classes'::regclass
  ) then
    alter table public.live_classes
      add constraint live_classes_meeting_url_https_check
      check (meeting_url = '' or meeting_url ~ '^https://[^[:space:]]+$');
  end if;
end $$;

comment on column public.live_classes.meeting_url is
  'HTTPS meeting URL for the live class (Google Meet, Zoom, Teams, etc.).';
