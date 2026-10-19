# FluentPal

FluentPal is a Next.js application for practicing practical English through short, level-based exercises. Users can create an account, browse exercises, answer questions, track progress, and author their own exercises.

## Features

- Email sign-up and login with Supabase Auth
- Exercise library with beginner, intermediate, and advanced levels
- List and grid views with pagination
- Exercise creation, editing, and document upload
- Learner answer submission and progress tracking
- Admin progress dashboard

## Requirements

- Node.js 18.18 or newer
- A Supabase project

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a local environment file:

   ```bash
   copy .env.example .env.local
   ```

3. Add your Supabase values to `.env.local`:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
   ```

   Keep `SUPABASE_SERVICE_ROLE_KEY` private and never expose it in client-side code.

4. In the Supabase SQL editor, run `supabase/schema.sql`. Read `supabase/README.md` first. Do not run `supabase/cleanup-exercises.sql` unless you intend to delete exercise data.

   The files in `lib/` are older setup scripts. The schema file replaces them for current setup.

5. Start the development server:

   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000).

## Available scripts

- `npm run dev` starts the development server.
- `npm run build` creates a production build.
- `npm start` starts the production server.
- `npm run seed` seeds the database using `scripts/seed.mjs`.

## Bulk upload exercises

Save one or more exercises in a JSON file. The file can be a JSON array or an object with an `exercises` array. Each exercise uses the same fields as the exercise template in `public/templates/exercise.json`. For example:

```json
{
  "exercises": [
    {
      "title": "Everyday grammar",
      "category": "grammar-mistakes",
      "level": "beginner",
      "targetMinutes": 5,
      "visibility": "members",
      "questions": [
        {
          "prompt": "Choose the natural sentence.",
          "options": ["She works here.", "She work here.", "She working here.", "She are work here."],
          "answer": "A",
          "explanation": "Use the third-person singular form works."
        }
      ]
    }
  ]
}
```

Validate the whole file without writing to the database:

```powershell
node --env-file=.env.local scripts/bulk-upload.mjs .\exercises.json --dry-run
```

Upload after validation succeeds:

```powershell
node --env-file=.env.local scripts/bulk-upload.mjs .\exercises.json
```

The script requires `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`. It validates all exercises before uploading, publishes them, and assigns owner ID `3b455c49-cd89-406c-ba2d-c02dedcbf920`. Each run creates new exercises; it does not deduplicate existing content.

To shuffle options on exercises that have already been uploaded, the script reads the exercises, questions, and answer keys directly from Supabase. First preview the changes:

```powershell
node --env-file=.env.local scripts/shuffle-exercise-answers.mjs --dry-run
```

If the dry run matches the intended exercises, run without `--dry-run` to save the shuffled options:

```powershell
node --env-file=.env.local scripts/shuffle-exercise-answers.mjs
```

This updates exercises owned by `3b455c49-cd89-406c-ba2d-c02dedcbf920`. It balances correct answers across A-D within each exercise, avoids repeating the same correct-answer position on consecutive questions, and updates each answer key to match the moved correct option. Exercises with no stored questions are reported and skipped. The script checks all questions before making changes and attempts to restore earlier changes if an update fails.

## Routes

- `/` - Sign in and exercise library
- `/add` - Create an exercise
- `/exercise/[id]` - Practice an exercise
- `/edit/[id]` - Edit an owned exercise
- `/upload` - Upload exercise content
- `/admin` - View learner progress as an administrator

## Project structure

```text
app/       Next.js pages, layouts, and API routes
lib/       Supabase client and database SQL scripts
scripts/   Seed data and utility scripts
```
