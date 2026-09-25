-- Run this once in the Supabase SQL Editor for an existing database.
grant usage on schema public to supabase_auth_admin;
grant insert, select on table public.profiles to supabase_auth_admin;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, nullif(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_signup on auth.users;
create trigger on_signup
  after insert on auth.users
  for each row execute function public.handle_new_user();