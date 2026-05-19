create extension if not exists "pgcrypto";

create table if not exists public.book_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  idea text default '',
  titles jsonb default '[]'::jsonb,
  title text default '',
  description text default '',
  audience text default '',
  tone text default '',
  outline jsonb default '[]'::jsonb,
  structure jsonb default '[]'::jsonb,
  lessons jsonb default '{}'::jsonb,
  step text default 'idea',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.book_projects enable row level security;

create policy "Users can view own projects"
on public.book_projects for select
using (auth.uid() = user_id);

create policy "Users can insert own projects"
on public.book_projects for insert
with check (auth.uid() = user_id);

create policy "Users can update own projects"
on public.book_projects for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
