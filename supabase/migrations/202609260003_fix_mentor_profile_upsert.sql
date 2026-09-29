-- Supabase upsert(onConflict: 'user_id') needs a non-partial unique index.
drop index if exists public.mentors_user_id_unique;
create unique index mentors_user_id_unique on public.mentors(user_id);
