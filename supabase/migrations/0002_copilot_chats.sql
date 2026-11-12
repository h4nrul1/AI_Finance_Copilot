-- Each student's copilot chats, so they can start new ones and reopen earlier ones after signing back in.
-- Run this once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Until it's run, signed-in students' chats just aren't saved (the app shows a note and keeps working).

create table if not exists public.copilot_chats (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  messages jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The chat list is always "this student's chats, newest first".
create index if not exists copilot_chats_user_recent on public.copilot_chats (user_id, updated_at desc);

-- Row-level security: a student can only ever see and change their own chats.
alter table public.copilot_chats enable row level security;

create policy "Students can read their own chats"
  on public.copilot_chats for select
  using (auth.uid() = user_id);

create policy "Students can create their own chats"
  on public.copilot_chats for insert
  with check (auth.uid() = user_id);

create policy "Students can update their own chats"
  on public.copilot_chats for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Students can delete their own chats"
  on public.copilot_chats for delete
  using (auth.uid() = user_id);
