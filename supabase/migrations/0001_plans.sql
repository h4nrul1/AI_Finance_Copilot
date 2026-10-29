-- One saved semester plan per student account.
-- Run this once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.

create table if not exists public.plans (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- Row-level security: a student can only ever see and change their own plan.
alter table public.plans enable row level security;

create policy "Students can read their own plan"
  on public.plans for select
  using (auth.uid() = user_id);

create policy "Students can create their own plan"
  on public.plans for insert
  with check (auth.uid() = user_id);

create policy "Students can update their own plan"
  on public.plans for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Students can delete their own plan"
  on public.plans for delete
  using (auth.uid() = user_id);
