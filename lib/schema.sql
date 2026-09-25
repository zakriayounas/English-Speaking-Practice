create table profiles (id uuid primary key references auth.users on delete cascade, full_name text, role text not null default 'learner' check (role in ('learner','admin')));
grant usage on schema public to supabase_auth_admin;
grant insert, select on table public.profiles to supabase_auth_admin;
create table exercises (id uuid primary key default gen_random_uuid(), owner_id uuid references auth.users on delete set null, title text not null, category text, level text not null default 'beginner' check (level in ('beginner', 'intermediate', 'advanced')), published boolean default false, status text not null default 'draft' check (status in ('draft', 'published')), time_limit_min int, created_at timestamptz default now());
create table questions (id uuid primary key default gen_random_uuid(), exercise_id uuid references exercises on delete cascade, position int, type text not null default 'mcq', points int default 1, content jsonb not null);
-- correct answers live in a separate table that learners can never read
create table question_keys (question_id uuid primary key references questions on delete cascade, answer jsonb not null, explanation text);
create table attempts (id uuid primary key default gen_random_uuid(), user_id uuid references auth.users, exercise_id uuid references exercises, score int, max_score int, submitted_at timestamptz default now());
create table attempt_answers (attempt_id uuid references attempts on delete cascade, question_id uuid references questions, answer jsonb, is_correct boolean, primary key (attempt_id, question_id));

create function public.is_admin() returns boolean language sql security definer set search_path = public as $$ select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin') $$;
create function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$ begin insert into public.profiles(id, full_name) values (new.id, nullif(new.raw_user_meta_data->>'full_name', '')) on conflict (id) do nothing; return new; end $$;
create trigger on_signup after insert on auth.users for each row execute function public.handle_new_user();

alter table profiles enable row level security;
alter table exercises enable row level security;
alter table questions enable row level security;
alter table question_keys enable row level security;
alter table attempts enable row level security;
alter table attempt_answers enable row level security;

create policy "own profile" on profiles for select using (id = auth.uid() or is_admin());
create policy "read exercises" on exercises for select using (published or is_admin());
create policy "admin exercises" on exercises for all using (is_admin());
create policy "authors read own exercises" on exercises for select using (owner_id = auth.uid());
create policy "authors create exercises" on exercises for insert with check (owner_id = auth.uid());
create policy "authors update exercises" on exercises for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "read questions" on questions for select using (exists (select 1 from exercises e where e.id = exercise_id and (e.published or is_admin())));
create policy "admin questions" on questions for all using (is_admin());
create policy "authors manage questions" on questions for all using (exists (select 1 from exercises e where e.id = exercise_id and e.owner_id = auth.uid())) with check (exists (select 1 from exercises e where e.id = exercise_id and e.owner_id = auth.uid()));
create policy "admin keys" on question_keys for all using (is_admin());
create policy "authors manage keys" on question_keys for all using (exists (select 1 from questions q join exercises e on e.id = q.exercise_id where q.id = question_id and e.owner_id = auth.uid()));
create policy "own attempts" on attempts for select using (user_id = auth.uid() or is_admin());
create policy "own answers" on attempt_answers for select using (exists (select 1 from attempts a where a.id = attempt_id and (a.user_id = auth.uid() or is_admin())));

-- After you sign up once, make yourself admin:
-- update profiles set role = 'admin' where id = (select id from auth.users where email = 'YOUR_EMAIL');
