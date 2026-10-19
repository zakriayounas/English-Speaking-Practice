# FluentPal database setup

`schema.sql` is the current database setup. It is safe to review and run on a new Supabase project or on the existing one.

The older scripts in `lib/` remain as history. Use this file for new setup.

## What the script does

- Extends `profiles` with English level, onboarding status, timer preference, daily goal, and timestamps.
- Adds `categories`, `profile_categories`, and `profile_goals`.
- Adds exercise `category_id`, `visibility` (`public` or `members`), and `target_seconds`.
- Copies each question prompt into a `text` column. Explanations stay in `question_keys.explanation`, which is already `text`.
- Stores attempt start time, duration, target snapshot, and per-question time.
- Replaces the signup trigger so a new learner gets the submitted full name, or the email prefix when the name is blank. Existing profiles, including administrators, are left unchanged.
- Turns on row level security for application tables.
- Seeds the learning categories and groups them with an `area` label. Running it again updates names, areas, and sort order. Descriptions, images, and active flags are kept. A previous Feelings category is deactivated after any saved exercises and preferences are moved to Speaking and Conversation.

## What it does not do

- It does not drop tables.
- It does not delete exercises, questions, attempts, answers, profiles, or auth users.
- It does not change an existing user's role.
- It does not run the exercise cleanup. That script is `cleanup-exercises.sql` and must not be run until you explicitly decide to delete exercise data.

Replacing policies and triggers does not delete rows. Filling a blank `full_name` from the email prefix, filling an empty `visibility`, and copying `time_limit_min` into an empty `target_seconds` only writes values that were missing.

Existing learners get `onboarding_status = pending` when that column is added. They will see onboarding once and can skip it.

`published` and `status` stay in place. New access rules use `visibility`. A previously published exercise becomes `public`. Every other exercise becomes `members`.

## Before you run it

1. Open `supabase/schema.sql` and read it.
2. In the Supabase dashboard, use the SQL editor for the correct project.
3. Paste the full file and run it once.
4. Do not run `cleanup-exercises.sql` in this step.

The script is written so running it again does not create duplicate categories or profiles.

## After you run it

Use the SQL editor to check the result:

```sql
select slug, name, image_path, active from public.categories order by sort_order;

select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name in ('profiles', 'exercises', 'questions', 'attempts', 'attempt_answers')
order by table_name, ordinal_position;

select relname, relrowsecurity
from pg_class
where relname in (
  'profiles', 'categories', 'exercises', 'questions', 'question_keys',
  'attempts', 'attempt_answers', 'profile_categories', 'profile_goals'
);
```

Expect the active learning categories, `prompt` and `explanation` as `text`, and row level security enabled on each listed table. Cards with no exercises are topics waiting for content, not finished lessons.

To confirm an administrator is still an administrator:

```sql
select id, full_name, role from public.profiles where role = 'admin';
```

## Make yourself an administrator

Signup always creates a learner. After your account exists, promote it once:

```sql
update public.profiles
set role = 'admin'
where id = (select id from auth.users where email = 'YOUR_EMAIL');
```

A learner cannot do this from the app. The profile trigger restores `role` unless the signed-in user is already an administrator, or the change is made by the database service role.
