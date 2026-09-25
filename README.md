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

4. In the Supabase SQL editor, run the database scripts in `lib/` as needed:

   - `lib/schema.sql` creates the base database schema.
   - `lib/exercise-authoring.sql` adds exercise-authoring support.
   - `lib/fix-auth-trigger.sql` applies the auth trigger fix.

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
