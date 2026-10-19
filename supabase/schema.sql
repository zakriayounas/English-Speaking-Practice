-- FluentPal schema
-- Safe to run more than once on a fresh or existing project.
-- Adds columns, indexes, policies, functions, and category records.
-- Does not drop tables, delete exercises, delete attempts, or delete accounts.
-- Replacing a policy or trigger does not remove rows.

create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text,
  role text not null default 'learner' check (role in ('learner', 'admin')),
  english_level text,
  onboarding_status text not null default 'pending',
  show_timer boolean not null default true,
  daily_goal_minutes integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  area text,
  image_path text,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users on delete set null,
  title text not null,
  category text,
  category_id uuid references public.categories on delete set null,
  level text not null default 'beginner' check (level in ('beginner', 'intermediate', 'advanced')),
  published boolean default false,
  status text not null default 'draft' check (status in ('draft', 'published')),
  visibility text not null default 'members' check (visibility in ('public', 'members')),
  time_limit_min integer,
  target_seconds integer,
  created_at timestamptz default now()
);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid references public.exercises on delete cascade,
  position integer,
  type text not null default 'mcq',
  points integer default 1,
  prompt text,
  content jsonb not null
);

create table if not exists public.question_keys (
  question_id uuid primary key references public.questions on delete cascade,
  answer jsonb not null,
  explanation text
);

create table if not exists public.attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users,
  exercise_id uuid references public.exercises,
  score integer,
  max_score integer,
  submitted_at timestamptz default now(),
  started_at timestamptz,
  duration_ms integer,
  target_seconds integer
);

create table if not exists public.attempt_answers (
  attempt_id uuid references public.attempts on delete cascade,
  question_id uuid references public.questions,
  answer jsonb,
  is_correct boolean,
  time_ms integer,
  primary key (attempt_id, question_id)
);

create table if not exists public.profile_categories (
  profile_id uuid references public.profiles on delete cascade,
  category_id uuid references public.categories on delete cascade,
  primary key (profile_id, category_id)
);

create table if not exists public.profile_goals (
  profile_id uuid references public.profiles on delete cascade,
  goal text not null,
  primary key (profile_id, goal)
);

grant usage on schema public to supabase_auth_admin;
grant insert, select on table public.profiles to supabase_auth_admin;

alter table public.profiles add column if not exists english_level text;
alter table public.profiles add column if not exists onboarding_status text not null default 'pending';
alter table public.profiles add column if not exists show_timer boolean not null default true;
alter table public.profiles add column if not exists daily_goal_minutes integer;
alter table public.profiles add column if not exists created_at timestamptz not null default now();
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

alter table public.profiles drop constraint if exists profiles_english_level_check;
alter table public.profiles add constraint profiles_english_level_check check (english_level is null or english_level in ('beginner', 'intermediate', 'advanced'));
alter table public.profiles drop constraint if exists profiles_onboarding_status_check;
alter table public.profiles add constraint profiles_onboarding_status_check check (onboarding_status in ('pending', 'completed', 'skipped'));
alter table public.profiles drop constraint if exists profiles_daily_goal_minutes_check;
alter table public.profiles add constraint profiles_daily_goal_minutes_check check (daily_goal_minutes is null or (daily_goal_minutes > 0 and daily_goal_minutes <= 240));
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('learner', 'admin'));

alter table public.exercises add column if not exists owner_id uuid references auth.users on delete set null;
alter table public.exercises add column if not exists category text;
alter table public.exercises add column if not exists category_id uuid references public.categories on delete set null;
alter table public.exercises add column if not exists published boolean default false;
alter table public.exercises add column if not exists status text not null default 'draft';
alter table public.exercises add column if not exists visibility text;
alter table public.exercises add column if not exists time_limit_min integer;
alter table public.exercises add column if not exists target_seconds integer;
alter table public.exercises add column if not exists created_at timestamptz default now();

update public.exercises
set visibility = case when coalesce(published, false) then 'public' else 'members' end
where visibility is null;

alter table public.exercises alter column visibility set default 'members';
alter table public.exercises alter column visibility set not null;

alter table public.exercises drop constraint if exists exercises_status_check;
alter table public.exercises add constraint exercises_status_check check (status in ('draft', 'published'));
alter table public.exercises drop constraint if exists exercises_level_check;
alter table public.exercises add constraint exercises_level_check check (level in ('beginner', 'intermediate', 'advanced'));
alter table public.exercises drop constraint if exists exercises_visibility_check;
alter table public.exercises add constraint exercises_visibility_check check (visibility in ('public', 'members'));
alter table public.exercises drop constraint if exists exercises_target_seconds_check;
alter table public.exercises add constraint exercises_target_seconds_check check (target_seconds is null or target_seconds > 0);

update public.exercises
set target_seconds = time_limit_min * 60
where target_seconds is null and time_limit_min is not null and time_limit_min > 0;

alter table public.questions add column if not exists prompt text;
update public.questions
set prompt = content->>'prompt'
where prompt is null and content ? 'prompt';

alter table public.attempts add column if not exists started_at timestamptz;
alter table public.attempts add column if not exists duration_ms integer;
alter table public.attempts add column if not exists target_seconds integer;
alter table public.attempts drop constraint if exists attempts_duration_ms_check;
alter table public.attempts add constraint attempts_duration_ms_check check (duration_ms is null or duration_ms >= 0);
alter table public.attempts drop constraint if exists attempts_target_seconds_check;
alter table public.attempts add constraint attempts_target_seconds_check check (target_seconds is null or target_seconds > 0);

alter table public.attempt_answers add column if not exists time_ms integer;
alter table public.attempt_answers drop constraint if exists attempt_answers_time_ms_check;
alter table public.attempt_answers add constraint attempt_answers_time_ms_check check (time_ms is null or time_ms >= 0);

alter table public.profile_goals drop constraint if exists profile_goals_goal_check;
alter table public.profile_goals add constraint profile_goals_goal_check check (goal in (
  'speak-confidence',
  'workplace-business',
  'software-team',
  'ielts-speaking',
  'daily-conversations',
  'fix-mistakes',
  'idioms-phrases'
));

alter table public.categories add column if not exists area text;

insert into public.categories (slug, name, description, area, image_path, sort_order)
values
  ('grammar-mistakes', 'Grammar and Common Mistakes', 'Nouns, pronouns, verbs, adjectives, adverbs, articles, prepositions, conjunctions, determiners, tenses, sentence structure, agreement, conditionals, active and passive voice, reported speech, and the grammar mistakes learners make most often.', 'Grammar', '/categories/grammar-mistakes.jpg', 10),
  ('vocabulary-synonyms', 'Vocabulary and Word Choice', 'Everyday words, synonyms, antonyms, word formation, commonly confused words, and when a word is formal or informal.', 'Vocabulary', '/categories/vocabulary-synonyms.jpg', 20),
  ('phrasal-verbs-collocations', 'Phrasal Verbs and Collocations', 'Phrasal verbs and the word pairings that sound natural together.', 'Vocabulary', '/categories/phrasal-verbs-collocations.jpg', 30),
  ('idioms-phrases', 'Idioms and Figurative Language', 'Idioms, native phrases, and figurative expressions people use without translating word for word.', 'Vocabulary', '/categories/idioms-phrases.jpg', 40),
  ('daily-conversation', 'Daily Life and Situations', 'Greetings, introductions, family, home, routines, food, restaurants, shopping, travel, directions, health, hobbies, and other ordinary situations.', 'Daily life', '/categories/daily-conversation.jpg', 50),
  ('speaking-conversation', 'Speaking and Conversation', 'Fluency, questions, opinions, agreement and disagreement, requests, apologies, storytelling, tone, politeness, and natural conversation.', 'Communication', '/categories/speaking-conversation.jpg', 60),
  ('listening-pronunciation', 'Listening and Pronunciation', 'Understanding real speech, including stress, connected words, and clear pronunciation.', 'Communication', '/categories/listening-pronunciation.jpg', 70),
  ('workplace-english', 'Workplace and Business English', 'Professional conversations, meetings, email, presentations, interviews, negotiation, teamwork, customer service, leadership, and workplace phrases.', 'Work', '/categories/workplace-english.jpg', 80),
  ('software-dev-communication', 'Software Team Communication', 'Standups, reviews, incidents, and the other English software teams use at work.', 'Work', '/categories/software-dev-communication.jpg', 90),
  ('reading-writing', 'Reading and Writing', 'Reading comprehension, sentence and paragraph building, summaries, paraphrasing, formal writing, and academic English.', 'Reading and writing', '/categories/reading-writing.jpg', 100),
  ('ielts-speaking', 'IELTS and Exam Speaking', 'Cue cards, follow-up questions, and timed speaking practice for IELTS-style exams.', 'Exams', '/categories/ielts-speaking.jpg', 110)
on conflict (slug) do update set
  name = excluded.name,
  area = excluded.area,
  sort_order = excluded.sort_order;

update public.exercises as exercise
set category_id = speaking.id,
    category = speaking.name
from public.categories as speaking, public.categories as feelings
where speaking.slug = 'speaking-conversation'
  and feelings.slug = 'emotions-expressions'
  and exercise.category_id = feelings.id;

insert into public.profile_categories (profile_id, category_id)
select preference.profile_id, speaking.id
from public.profile_categories as preference
join public.categories as feelings on feelings.id = preference.category_id and feelings.slug = 'emotions-expressions'
join public.categories as speaking on speaking.slug = 'speaking-conversation'
on conflict do nothing;

delete from public.profile_categories as preference
using public.categories as feelings
where preference.category_id = feelings.id
  and feelings.slug = 'emotions-expressions'
  and exists (select 1 from public.categories where slug = 'speaking-conversation');

update public.categories
set active = false
where slug = 'emotions-expressions'
  and exists (select 1 from public.categories where slug = 'speaking-conversation');

update public.exercises e
set category_id = c.id
from public.categories c
where e.category_id is null
  and e.category is not null
  and (lower(btrim(e.category)) = c.slug or lower(btrim(e.category)) = lower(c.name));

do $$
begin
  update public.profiles p
  set created_at = u.created_at
  from auth.users u
  where u.id = p.id
    and (p.created_at is null or p.created_at > u.created_at + interval '1 minute');

  update public.profiles p
  set full_name = split_part(u.email, '@', 1)
  from auth.users u
  where u.id = p.id
    and u.email is not null
    and (p.full_name is null or btrim(p.full_name) = '');
exception when insufficient_privilege or undefined_table then
  raise notice 'Skipped profile backfill from auth.users.';
end $$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  chosen_name text;
begin
  chosen_name := nullif(btrim(coalesce(new.raw_user_meta_data->>'full_name', '')), '');
  if chosen_name is null then
    chosen_name := nullif(split_part(coalesce(new.email, ''), '@', 1), '');
  end if;
  insert into public.profiles (id, full_name, role)
  values (new.id, chosen_name, 'learner')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_signup on auth.users;
create trigger on_signup
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.protect_profile_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.id is distinct from old.id then
    raise exception 'Profile id cannot be changed';
  end if;
  if new.role is distinct from old.role and auth.uid() is not null and not public.is_admin() then
    new.role := old.role;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists protect_profile_update on public.profiles;
create trigger protect_profile_update
  before update on public.profiles
  for each row execute function public.protect_profile_update();

create or replace function public.save_completed_attempt(
  p_user_id uuid,
  p_exercise_id uuid,
  p_score integer,
  p_max_score integer,
  p_started_at timestamptz,
  p_duration_ms integer,
  p_target_seconds integer,
  p_answers jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
  item jsonb;
  question_uuid uuid;
begin
  if p_user_id is null then
    raise exception 'Guest attempts are not stored';
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'Profile not found';
  end if;
  if p_duration_ms is not null and p_duration_ms < 0 then
    raise exception 'Invalid duration';
  end if;

  insert into public.attempts (
    user_id, exercise_id, score, max_score, submitted_at, started_at, duration_ms, target_seconds
  ) values (
    p_user_id, p_exercise_id, p_score, p_max_score, now(), p_started_at, p_duration_ms, p_target_seconds
  ) returning id into new_id;

  for item in select * from jsonb_array_elements(coalesce(p_answers, '[]'::jsonb))
  loop
    question_uuid := (item->>'question_id')::uuid;
    if not exists (
      select 1 from public.questions
      where id = question_uuid and exercise_id = p_exercise_id
    ) then
      raise exception 'Question does not belong to this exercise';
    end if;
    insert into public.attempt_answers (attempt_id, question_id, answer, is_correct, time_ms)
    values (
      new_id,
      question_uuid,
      item->'answer',
      coalesce((item->>'is_correct')::boolean, false),
      case
        when item->>'time_ms' is null or item->>'time_ms' = '' then null
        else (item->>'time_ms')::integer
      end
    );
  end loop;

  return new_id;
end;
$$;

revoke all on function public.save_completed_attempt(uuid, uuid, integer, integer, timestamptz, integer, integer, jsonb) from public, anon, authenticated;
grant execute on function public.save_completed_attempt(uuid, uuid, integer, integer, timestamptz, integer, integer, jsonb) to service_role;

create index if not exists exercises_category_visibility_level_idx on public.exercises (category_id, visibility, level);
create index if not exists exercises_created_at_idx on public.exercises (created_at desc);
create index if not exists questions_exercise_position_idx on public.questions (exercise_id, position);
create index if not exists attempts_user_submitted_idx on public.attempts (user_id, submitted_at desc);
create index if not exists attempts_exercise_idx on public.attempts (exercise_id);
create index if not exists attempt_answers_question_idx on public.attempt_answers (question_id);
create index if not exists profile_categories_category_idx on public.profile_categories (category_id);

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.exercises enable row level security;
alter table public.questions enable row level security;
alter table public.question_keys enable row level security;
alter table public.attempts enable row level security;
alter table public.attempt_answers enable row level security;
alter table public.profile_categories enable row level security;
alter table public.profile_goals enable row level security;

drop policy if exists "own profile" on public.profiles;
drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_select_own on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy profiles_update_own on public.profiles for update using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());

drop policy if exists categories_select on public.categories;
drop policy if exists categories_admin_write on public.categories;
create policy categories_select on public.categories for select using (true);
create policy categories_admin_write on public.categories for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "read exercises" on public.exercises;
drop policy if exists "admin exercises" on public.exercises;
drop policy if exists "authors read own exercises" on public.exercises;
drop policy if exists "authors create exercises" on public.exercises;
drop policy if exists "authors update exercises" on public.exercises;
drop policy if exists exercises_select on public.exercises;
drop policy if exists exercises_admin_write on public.exercises;
create policy exercises_select on public.exercises for select using (
  public.is_admin()
  or visibility = 'public'
  or (visibility = 'members' and auth.uid() is not null)
);
create policy exercises_admin_write on public.exercises for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "read questions" on public.questions;
drop policy if exists "admin questions" on public.questions;
drop policy if exists "authors manage questions" on public.questions;
drop policy if exists questions_select on public.questions;
drop policy if exists questions_admin_write on public.questions;
create policy questions_select on public.questions for select using (
  exists (
    select 1 from public.exercises e
    where e.id = exercise_id
      and (
        public.is_admin()
        or e.visibility = 'public'
        or (e.visibility = 'members' and auth.uid() is not null)
      )
  )
);
create policy questions_admin_write on public.questions for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin keys" on public.question_keys;
drop policy if exists "authors manage keys" on public.question_keys;
drop policy if exists question_keys_admin on public.question_keys;
create policy question_keys_admin on public.question_keys for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "own attempts" on public.attempts;
drop policy if exists attempts_select on public.attempts;
drop policy if exists attempts_insert on public.attempts;
create policy attempts_select on public.attempts for select using (user_id = auth.uid() or public.is_admin());
create policy attempts_insert on public.attempts for insert with check (user_id = auth.uid());

drop policy if exists "own answers" on public.attempt_answers;
drop policy if exists attempt_answers_select on public.attempt_answers;
drop policy if exists attempt_answers_insert on public.attempt_answers;
create policy attempt_answers_select on public.attempt_answers for select using (
  exists (
    select 1 from public.attempts a
    where a.id = attempt_id and (a.user_id = auth.uid() or public.is_admin())
  )
);
create policy attempt_answers_insert on public.attempt_answers for insert with check (
  exists (
    select 1 from public.attempts a
    where a.id = attempt_id and a.user_id = auth.uid()
  )
);

drop policy if exists profile_categories_own on public.profile_categories;
create policy profile_categories_own on public.profile_categories for all
  using (profile_id = auth.uid() or public.is_admin())
  with check (profile_id = auth.uid() or public.is_admin());

drop policy if exists profile_goals_own on public.profile_goals;
create policy profile_goals_own on public.profile_goals for all
  using (profile_id = auth.uid() or public.is_admin())
  with check (profile_id = auth.uid() or public.is_admin());

grant select on public.categories to anon, authenticated;
grant insert, update, delete on public.categories to authenticated;
grant select on public.exercises to anon, authenticated;
grant insert, update, delete on public.exercises to authenticated;
grant select on public.questions to anon, authenticated;
grant insert, update, delete on public.questions to authenticated;
grant select, insert, update, delete on public.question_keys to authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert on public.attempts to authenticated;
grant select, insert on public.attempt_answers to authenticated;
grant select, insert, update, delete on public.profile_categories to authenticated;
grant select, insert, update, delete on public.profile_goals to authenticated;
