-- Exercise cleanup
-- DO NOT RUN until you have explicitly confirmed that existing exercises should be deleted.
-- This removes every exercise, its questions, answer keys, attempts, and attempt answers.
-- It does not delete profiles, categories, preference rows, or auth users.
-- Attempts that are not linked to an exercise are left in place.

begin;

delete from public.attempt_answers
where question_id in (
  select id from public.questions
  where exercise_id in (select id from public.exercises)
)
or attempt_id in (
  select id from public.attempts
  where exercise_id in (select id from public.exercises)
);

delete from public.attempts
where exercise_id in (select id from public.exercises);

delete from public.exercises;

commit;
