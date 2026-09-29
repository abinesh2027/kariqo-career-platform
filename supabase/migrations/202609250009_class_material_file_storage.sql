-- Private file storage for mentor class materials (15 MB max per file).
alter table public.mentor_class_materials
  add column if not exists storage_path text;

alter table public.mentor_class_materials
  drop constraint if exists mentor_class_materials_url_check;
alter table public.mentor_class_materials
  add constraint mentor_class_materials_url_check
  check (char_length(url) <= 2048 and (url = '' or url ~ '^https?://'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'mentor-class-materials',
  'mentor-class-materials',
  false,
  15728640,
  array[
    'application/pdf',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'image/png',
    'image/jpeg',
    'image/webp'
  ]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "mentors upload materials for own classes" on storage.objects;
create policy "mentors upload materials for own classes" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'mentor-class-materials'
    and exists (
      select 1 from public.live_classes c
      join public.mentor_accounts m on m.user_id = auth.uid()
      where c.id::text = split_part(name, '/', 1)
        and c.instructor_id = auth.uid()
    )
  );

drop policy if exists "users read published class materials" on storage.objects;
create policy "users read published class materials" on storage.objects
  for select to authenticated using (
    bucket_id = 'mentor-class-materials'
    and exists (
      select 1 from public.live_classes c
      where c.id::text = split_part(name, '/', 1) and c.published
    )
  );

drop policy if exists "mentors delete materials for own classes" on storage.objects;
create policy "mentors delete materials for own classes" on storage.objects
  for delete to authenticated using (
    bucket_id = 'mentor-class-materials'
    and exists (
      select 1 from public.live_classes c
      join public.mentor_accounts m on m.user_id = auth.uid()
      where c.id::text = split_part(name, '/', 1)
        and c.instructor_id = auth.uid()
    )
  );
