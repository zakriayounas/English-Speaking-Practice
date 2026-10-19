# Possible later work

These ideas are not part of the current app. Each note is only a sketch of the work it would take.

## Learning engine

**Review mistakes.** Add a mode that reopens questions the learner previously missed. It can read `attempt_answers.is_correct` for that user. An index on `(question_id, is_correct)` would keep the lookup small. No new table is required for a first version.

**Retry wrong answers only.** This is the same data as review mode, limited to one past attempt. The attempt page would load a filtered question list and save a new attempt so the original result stays unchanged.

**Spaced repetition.** Add a review table with the user, question, next review time, and interval. A daily query would select rows whose next review time has passed. Updating the interval belongs in one server function so the client cannot invent the schedule.

**Daily goals and streaks.** The profile already stores an optional daily goal in minutes. A streak needs one row per user per day, or a counter plus the last practice date. The write should happen when an attempt is saved, not from the browser clock alone. A scheduled job is only needed if inactive streaks must be cleared overnight.

**Bookmarks and favorites.** Add a join table from profile to exercise. The exercises page would read that table for the signed-in user. The same row-level rules as the other preference tables would apply.

## More exercise types

**Fill-in-the-blank typing.** The question row would need a type and an accepted-answer list. Grading would move into the submit function. Explanations can stay as text.

**Audio playback and text-to-speech.** Store an audio path on the question or generate speech in the browser. Generated audio does not need a database column. Uploaded audio needs file storage and a path column. Playback controls stay on the attempt page.

**Speaking recordings and self-review.** Store the recording in private file storage and a row that points at the user, question, and file. Learners should be able to read only their own files. This needs a larger storage and privacy review before any recording is accepted.

**Shadowing.** Play a prompt, then record the learner. It uses the same audio and recording pieces above. Timing can reuse the per-question clock.

## Engagement

**Badges.** Add a badge catalog and a table of badges earned by a user. Award them when an attempt is saved, using rules such as attempt count or a perfect score. The profile page would read the earned rows.

**Team leaderboard.** Add a team and membership tables. The board would aggregate saved attempts for members of one team. It should not expose another team's learners. A cache is optional until the query is slow.

**Weekly progress emails.** A scheduled job would read each learner's attempts for the week and send one message. It needs an email provider, a send log so people are not mailed twice, and a preference to opt out.

## Admin tools

**Per-question difficulty.** Aggregate `attempt_answers` by question: attempts, correct count, and average time. A database view can do this without storing a second copy of the answers.

**Most-missed questions.** The same view, ordered by the lowest correct rate, with a minimum number of attempts so a single miss does not rise to the top.

**Draft versus published.** `exercises.status` is already present. The access rules would need a draft state that only administrators can read, separate from public and members-only.

**Exercise versioning.** Add a version number or a history table copied when an exercise is saved. Old attempts should keep the question ids they were scored against, which the current keys already allow if published questions are not rewritten in place.

**Tags.** Add a tag table and a join from exercises to tags. Filtering would use that join. Tags are optional labels and would not replace the category.

**CSV export.** An administrator-only API route can stream attempts and scores. It should page the query and avoid loading every answer into memory at once.

## Platform

**Dark mode.** This is a theme change in the existing CSS variables. No database change is required unless the choice should follow the user across devices, in which case it is one profile column.

**Installable PWA.** Add a web manifest and a service worker. The app shell can be cached. Attempts should still be saved online; an offline queue would be a separate piece of work.

**Rate limiting for guest attempts.** Guest results are not stored, but the submit route still grades them. A limit by address, enforced at the host or in the submit route, would reduce automated grading. It should not require an account.
