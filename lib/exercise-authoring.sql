-- Run this once in Supabase SQL Editor for an existing project.
alter table public.exercises add column if not exists owner_id uuid references auth.users on delete set null;
alter table public.exercises add column if not exists status text not null default 'draft';
alter table public.exercises drop constraint if exists exercises_status_check;
alter table public.exercises add constraint exercises_status_check check (status in ('draft', 'published'));

drop policy if exists "authors read own exercises" on public.exercises;
drop policy if exists "authors create exercises" on public.exercises;
drop policy if exists "authors update exercises" on public.exercises;
create policy "authors read own exercises" on public.exercises for select using (owner_id = auth.uid());
create policy "authors create exercises" on public.exercises for insert with check (owner_id = auth.uid());
create policy "authors update exercises" on public.exercises for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "authors manage questions" on public.questions;
create policy "authors manage questions" on public.questions for all using (exists (select 1 from public.exercises e where e.id = exercise_id and e.owner_id = auth.uid())) with check (exists (select 1 from public.exercises e where e.id = exercise_id and e.owner_id = auth.uid()));

drop policy if exists "authors manage keys" on public.question_keys;
create policy "authors manage keys" on public.question_keys for all using (exists (select 1 from public.questions q join public.exercises e on e.id = q.exercise_id where q.id = question_id and e.owner_id = auth.uid()));