-- Crate schema. Run once against the Supabase database: see scripts/db.mjs
-- Anyone may read; only the server (service role, which bypasses RLS) writes.

create table if not exists walls (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  position int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists records (
  id uuid primary key default gen_random_uuid(),
  wall_id uuid not null references walls (id) on delete cascade,
  slot int not null check (slot between 0 and 24), -- 25 per wall, 5 per row
  video_id text not null,
  title text not null,
  artist text not null,
  album text not null default '',
  artwork_url text not null,
  duration_ms int not null default 0,
  palette jsonb not null,
  added_at timestamptz not null default now(),
  unique (wall_id, slot)
);

alter table walls enable row level security;
alter table records enable row level security;

drop policy if exists "walls are public" on walls;
create policy "walls are public" on walls for select using (true);
drop policy if exists "records are public" on records;
create policy "records are public" on records for select using (true);
