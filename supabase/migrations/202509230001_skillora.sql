-- Skillora starter schema. Run with `supabase db push` after linking a project.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  college text not null default '',
  course text not null default '',
  career_goal text not null default '',
  bio text not null default '',
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.skills (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  name text not null, score int not null default 0 check(score between 0 and 100), evidence jsonb not null default '[]', updated_at timestamptz not null default now(), unique(user_id,name)
);
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  title text not null, description text not null default '', status text not null default 'in_progress', progress int not null default 0 check(progress between 0 and 100), created_at timestamptz not null default now()
);
create table if not exists public.roadmaps (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  career_goal text not null, content jsonb not null default '{}', created_at timestamptz not null default now()
);
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  title text not null, body text not null default '', read_at timestamptz, created_at timestamptz not null default now()
);
create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  topic text not null, body text not null, created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
alter table public.skills enable row level security;
alter table public.projects enable row level security;
alter table public.roadmaps enable row level security;
alter table public.notifications enable row level security;
alter table public.support_messages enable row level security;
create policy "profiles own rows" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "skills own rows" on public.skills for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "projects own rows" on public.projects for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "roadmaps own rows" on public.roadmaps for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "notifications own rows" on public.notifications for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "support own rows" on public.support_messages for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
insert into storage.buckets(id,name,public) values ('avatars','avatars',false) on conflict (id) do nothing;
create policy "avatar owner read" on storage.objects for select to authenticated using (bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "avatar owner upload" on storage.objects for insert to authenticated with check (bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "avatar owner update" on storage.objects for update to authenticated using (bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text) with check (bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text);
