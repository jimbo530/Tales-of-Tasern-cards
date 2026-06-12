-- Shared map pins for the adventure map editor.
-- Stores ONE row (id = 'default') whose `pins` JSON array holds every pin
-- placed in /map-editor. This makes pin positions + paths durable and shared
-- across all players and devices (not just the editing browser's localStorage).
--
-- Run this once in the Supabase SQL editor to enable cloud-synced pins.
-- The game works without it (falls back to localStorage + adventureData.ts),
-- but pins placed in the editor will only persist locally until this exists.

create table if not exists map_pins (
  id text primary key,
  pins jsonb not null default '[]',
  updated_at timestamptz not null default now()
);

alter table map_pins enable row level security;

-- Pins are public, read-only game content — anyone may read them.
create policy "Anyone can read map pins" on map_pins for select using (true);

-- Authoring is gated in the UI (admin wallet + NEXT_PUBLIC_MAP_EDITOR=1).
-- These open write policies match the existing adventure_saves table; tighten
-- later if the editor is ever exposed beyond trusted admins.
create policy "Anyone can insert map pins" on map_pins for insert with check (true);
create policy "Anyone can update map pins" on map_pins for update using (true);
