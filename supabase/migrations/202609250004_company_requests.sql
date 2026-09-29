-- Employer registration requests remain pending until an owner explicitly approves them.
create table if not exists public.skillora_company_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  company_name text not null check (char_length(company_name) between 2 and 120),
  contact_name text not null default '',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
alter table public.skillora_company_requests enable row level security;
grant all on public.skillora_company_requests to service_role;

create or replace function public.handle_skillora_company_request()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.raw_user_meta_data ->> 'account_type' = 'company'
    and char_length(trim(coalesce(new.raw_user_meta_data ->> 'company_name', ''))) >= 2 then
    insert into public.skillora_company_requests(user_id, company_name, contact_name)
    values (
      new.id,
      left(trim(new.raw_user_meta_data ->> 'company_name'), 120),
      left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120)
    )
    on conflict (user_id) do nothing;
  end if;
  return new;
end;
$$;
drop trigger if exists skillora_company_request_on_auth_insert on auth.users;
create trigger skillora_company_request_on_auth_insert after insert on auth.users
for each row execute procedure public.handle_skillora_company_request();

create or replace function public.review_skillora_company_request(request_id uuid, decision text)
returns table(company_id uuid, company_name text, user_id uuid, status text)
language plpgsql security definer set search_path = ''
as $$
declare
  request_row public.skillora_company_requests%rowtype;
  new_company_id uuid;
begin
  if decision not in ('approve', 'reject') then raise exception 'Decision must be approve or reject'; end if;
  select * into request_row from public.skillora_company_requests where id = request_id for update;
  if not found then raise exception 'Company request not found'; end if;
  if request_row.status <> 'pending' then raise exception 'Company request has already been reviewed'; end if;

  if decision = 'approve' then
    insert into public.skillora_companies(name) values (request_row.company_name) returning id into new_company_id;
    insert into public.skillora_company_accounts(user_id, company_id, approved)
      values (request_row.user_id, new_company_id, true);
    update public.skillora_company_requests set status = 'approved', reviewed_at = now() where id = request_row.id;
    return query select new_company_id, request_row.company_name, request_row.user_id, 'approved'::text;
  else
    update public.skillora_company_requests set status = 'rejected', reviewed_at = now() where id = request_row.id;
    return query select null::uuid, request_row.company_name, request_row.user_id, 'rejected'::text;
  end if;
end;
$$;
revoke all on function public.review_skillora_company_request(uuid, text) from public, anon, authenticated;
grant execute on function public.review_skillora_company_request(uuid, text) to service_role;
