-- Open Banking (Enable Banking, PSD2): conexiones bancarias + id externo de movimientos.
-- Ejecutar una vez en Supabase → SQL Editor. Es idempotente (se puede repetir).
--
-- Notas de diseño:
--  · Una fila por CUENTA bancaria. Varias filas pueden compartir session_id (una
--    sesión de Enable Banking puede autorizar varias cuentas).
--  · session_id / account_uid solo sirven junto a la clave privada de la app
--    (ENABLE_BANKING_PRIVATE_KEY, que vive solo en Cloudflare): sin ella no dan acceso.
--  · Nunca se guardan credenciales bancarias ni el IBAN completo (solo enmascarado).
--  · Columnas añadidas a las pedidas:
--      account_id       cuenta de Omegus donde se importan los movimientos
--      account_key      huella (hash) estable de la cuenta: permite renovar el consentimiento
--                       sin duplicar la conexión ni los movimientos
--      last_attempt_at  último intento de sincronización (limita las consultas a 1 cada 6 h)
--      last_error       motivo del último fallo, para mostrarlo en Ajustes

create table if not exists public.bank_connections (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  session_id      text not null,
  account_uid     text not null,
  account_key     text not null,
  account_id      uuid references public.accounts (id) on delete set null,
  bank_name       text not null,
  iban_masked     text,
  expires_at      timestamptz not null,
  last_synced_at  timestamptz,
  last_attempt_at timestamptz,
  last_error      text,
  created_at      timestamptz not null default now(),
  unique (user_id, account_key)
);

create index if not exists bank_connections_user_id_idx on public.bank_connections (user_id);
create index if not exists bank_connections_session_idx on public.bank_connections (session_id);

alter table public.bank_connections enable row level security;

drop policy if exists "bank_connections_select_own" on public.bank_connections;
drop policy if exists "bank_connections_insert_own" on public.bank_connections;
drop policy if exists "bank_connections_update_own" on public.bank_connections;
drop policy if exists "bank_connections_delete_own" on public.bank_connections;

create policy "bank_connections_select_own" on public.bank_connections
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "bank_connections_insert_own" on public.bank_connections
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "bank_connections_update_own" on public.bank_connections
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "bank_connections_delete_own" on public.bank_connections
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.bank_connections from anon;

-- ID del movimiento en el banco: evita duplicados al sincronizar.
-- Índice único NO parcial (los NULL no chocan entre sí) para poder usarlo con ON CONFLICT.
alter table public.transactions add column if not exists external_id text;

create unique index if not exists transactions_user_external_id_key
  on public.transactions (user_id, external_id);
