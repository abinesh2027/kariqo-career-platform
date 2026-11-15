-- Public GitHub links let a student share project evidence and opt into
-- repository-structure progress estimates. Existing row ownership policies
-- continue to protect these fields with the projects row.
alter table public.projects
  add column if not exists repository_url text,
  add column if not exists demo_url text,
  add column if not exists progress_source text not null default 'manual',
  add column if not exists progress_checked_at timestamptz;

alter table public.projects
  add constraint projects_repository_url_https
    check (repository_url is null or repository_url ~ '^https://github\.com/[^/]+/[^/]+/?([?#].*)?$') not valid,
  add constraint projects_demo_url_https
    check (demo_url is null or demo_url ~* '^https://') not valid;

alter table public.projects validate constraint projects_repository_url_https;
alter table public.projects validate constraint projects_demo_url_https;
