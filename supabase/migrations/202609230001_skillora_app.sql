-- Public catalog data is published by the Skillora team; student data remains owner-scoped.
create table if not exists public.opportunities (
  id uuid primary key default gen_random_uuid(), organization text not null, title text not null,
  description text not null default '', kind text not null default 'internship', location text not null default '',
  skills text[] not null default '{}', apply_url text, published boolean not null default false, created_at timestamptz not null default now()
);
create table if not exists public.opportunity_saves (
  user_id uuid not null references auth.users(id) on delete cascade,
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  created_at timestamptz not null default now(), primary key(user_id, opportunity_id)
);
create table if not exists public.mentors (
  id uuid primary key default gen_random_uuid(), full_name text not null, title text not null default '',
  bio text not null default '', expertise text[] not null default '{}', published boolean not null default false
);
create table if not exists public.mentor_sessions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  mentor_id uuid references public.mentors(id) on delete set null, starts_at timestamptz not null,
  status text not null default 'requested', note text not null default '', created_at timestamptz not null default now()
);
create table if not exists public.live_classes (
  id uuid primary key default gen_random_uuid(), title text not null, description text not null default '',
  instructor text not null default '', starts_at timestamptz not null, duration_minutes int not null default 60,
  capacity int, published boolean not null default false
);
create table if not exists public.class_registrations (
  user_id uuid not null references auth.users(id) on delete cascade,
  class_id uuid not null references public.live_classes(id) on delete cascade,
  created_at timestamptz not null default now(), primary key(user_id, class_id)
);
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(), title text not null, body text not null default '',
  author text not null default 'Brain Strom', published boolean not null default false, created_at timestamptz not null default now()
);
create table if not exists public.preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email_opportunities boolean not null default true, learning_reminders boolean not null default false,
  community_updates boolean not null default true, updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.skills enable row level security;
alter table public.projects enable row level security;
alter table public.roadmaps enable row level security;
alter table public.notifications enable row level security;
alter table public.support_messages enable row level security;
alter table public.opportunities enable row level security;
alter table public.opportunity_saves enable row level security;
alter table public.mentors enable row level security;
alter table public.mentor_sessions enable row level security;
alter table public.live_classes enable row level security;
alter table public.class_registrations enable row level security;
alter table public.announcements enable row level security;
alter table public.preferences enable row level security;

create policy "published opportunities readable" on public.opportunities for select to authenticated using (published);
create policy "own opportunity saves" on public.opportunity_saves for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "published mentors readable" on public.mentors for select to authenticated using (published);
create policy "own mentor sessions" on public.mentor_sessions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "published classes readable" on public.live_classes for select to authenticated using (published);
create policy "own class registrations" on public.class_registrations for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "published announcements readable" on public.announcements for select to authenticated using (published);
create policy "preferences own rows" on public.preferences for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.profiles, public.skills, public.projects, public.roadmaps,
  public.notifications, public.support_messages, public.opportunity_saves, public.mentor_sessions,
  public.class_registrations, public.preferences to authenticated;
grant select on public.opportunities, public.mentors, public.live_classes, public.announcements to authenticated;
grant select, insert, update, delete on storage.objects to authenticated;

create or replace function public.handle_skillora_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles(id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', '')) on conflict (id) do nothing;
  insert into public.preferences(user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;
create trigger skillora_on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_skillora_new_user();
