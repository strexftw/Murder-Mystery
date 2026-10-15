-- =========================================================
-- IL GIOCO DELL'ASSASSINO — DATABASE COMPLETO (Step 1 → 5)
-- Rieseguibile all'infinito senza errori: tutto idempotente.
-- =========================================================

create table if not exists public.rooms (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  name       text not null,
  host_uid   text not null,
  status     text not null default 'lobby',
  created_at timestamptz not null default now()
);

create table if not exists public.players (
  id        uuid primary key default gen_random_uuid(),
  room_id   uuid not null references public.rooms(id) on delete cascade,
  uid       text not null,
  name      text not null,
  is_host   boolean not null default false,
  online    boolean not null default true,
  last_seen timestamptz not null default now(),
  joined_at timestamptz not null default now(),
  unique (room_id, uid)
);

create table if not exists public.chat_messages (
  id         bigint generated always as identity primary key,
  room_id    uuid not null references public.rooms(id) on delete cascade,
  sender     text not null,
  message    text not null,
  is_system  boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists players_room_idx on public.players(room_id);
create index if not exists chat_room_idx    on public.chat_messages(room_id, id);

-- RLS attiva (se lo e gia, non cambia nulla)
alter table public.rooms         enable row level security;
alter table public.players       enable row level security;
alter table public.chat_messages enable row level security;

-- policy: prima le cancello se esistono, poi le ricreo (niente errore 42710)
drop policy if exists "rooms_all"   on public.rooms;
drop policy if exists "players_all" on public.players;
drop policy if exists "chat_all"    on public.chat_messages;

create policy "rooms_all"   on public.rooms         for all using (true) with check (true);
create policy "players_all" on public.players       for all using (true) with check (true);
create policy "chat_all"    on public.chat_messages for all using (true) with check (true);

-- =========================================================
-- Step 1.1 — dispositivo (pc / phone / tablet)
-- =========================================================
alter table public.players add column if not exists device text;

-- =========================================================
-- Step 2 — partita base: ruolo offuscato, codice personale,
-- alive, parola segreta (ormai in disuso), timer
-- =========================================================
alter table public.players add column if not exists role text;
alter table public.players add column if not exists code text;
alter table public.players add column if not exists alive boolean not null default true;
alter table public.rooms   add column if not exists secret_word text;
alter table public.rooms   add column if not exists started_at timestamptz;

-- =========================================================
-- Step 3 — colonne della vecchia carta coltello: tenute
-- per compatibilita con i reset precedenti (non usate dal
-- nuovo motore, ma azzerate da resetPartita)
-- =========================================================
alter table public.rooms   add column if not exists kill_target_uid text;
alter table public.rooms   add column if not exists kill_by_uid text;
alter table public.rooms   add column if not exists kill_at timestamptz;

-- =========================================================
-- Step 4 — sincronizzazione rivelazione ruolo + esito
-- ready:  conferma "ho letto il ruolo" (contata sul DB)
-- phase:  'reveal' (attesa conferme) | 'live' | 'fine'
-- winner: 'assassino' | 'ispettore' | null
-- =========================================================
alter table public.players add column if not exists ready boolean not null default false;
alter table public.rooms   add column if not exists phase text not null default 'reveal';
alter table public.rooms   add column if not exists winner text;

-- =========================================================
-- Step 5 — nuovo motore: carte identita, indizio del crime
-- scene, loop uccisioni del Sistema, indagini dell'Ispettore
-- card:           identita fittizia del giocatore (JSON)
-- clue:           indizio OFFUSCATO con l'uid del detective
-- next_kill_at:   scadenza del prossimo colpo del Sistema
-- last_kill_*:    ultima vittima (notifica + jumpscare)
-- indagini_usate: indagini dell'Ispettore (max 3)
-- skip_usati:     skip dell'Ispettore (max 2)
-- =========================================================
alter table public.players add column if not exists card text;
alter table public.rooms   add column if not exists clue text;
alter table public.rooms   add column if not exists next_kill_at timestamptz;
alter table public.rooms   add column if not exists last_kill_at timestamptz;
alter table public.rooms   add column if not exists last_kill_uid text;
alter table public.rooms   add column if not exists indagini_usate integer not null default 0;
alter table public.rooms   add column if not exists skip_usati integer not null default 0;
