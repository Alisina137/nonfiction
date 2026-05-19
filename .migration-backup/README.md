<<<<<<< HEAD
# Nonfiction AI Studio

Premium full-stack AI SaaS for building structured nonfiction books in business, productivity, and money-making niches.

## Stack

- Next.js (Pages Router, JavaScript)
- Tailwind CSS
- Next.js API routes
- Supabase (Postgres + Auth with email/password)
- OpenAI API
- PDF export via `pdf-lib`

## Setup

1. Install dependencies:
   - `npm install`
2. Create `.env.local` from `.env.example`.
3. Run the SQL in `supabase/schema.sql` in Supabase SQL editor.
4. In Supabase Auth:
   - Enable Email provider.
   - Disable "Confirm email" for local testing if you want immediate sign-in after signup.
5. Start dev server:
   - `npm run dev`

6. **Analysis step (optional):** add `RAINFOREST_API_KEY` in `.env.local` to load Amazon search results sorted by bestseller rankings and to fetch expanded rating / bestseller rank per ASIN. Without the key you can still paste reference Amazon URLs manually.

## Core flow implemented

1. Idea input
2. Title generation and selection
3. Description generation
4. Audience selection
5. Tone selection (20 tones)
6. 8-10 chapter outline generation
7. 3x3 chapter structure generation
8. Subsection lesson generation
9. Continuity support via prior concept tracking
10. AI refinement actions + PDF export
=======
# book
>>>>>>> 46233c14297c1e9075f9488632040c497ee5245d
