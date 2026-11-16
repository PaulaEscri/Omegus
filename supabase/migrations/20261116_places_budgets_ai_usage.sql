-- Tablas nuevas: places, budgets, ai_usage
-- Todas con RLS estricto por user_id, sin acceso para anon y sin políticas públicas.
-- Reutiliza public.handle_updated_at() (ya existe, la usan profiles/accounts/transactions).

-- ── 0. Integridad entre usuarios ─────────────────────────────
-- Permite una FK compuesta (user_id, category_id) → categories(id, user_id), de modo
-- que un usuario NO pueda referenciar la categoría de otro. `id` ya es único, así
-- que esta restricción no cambia ningún dato existente.
alter table public.categories
  add constraint categories_id_user_id_key unique (id, user_id);

-- ── 1. places ────────────────────────────────────────────────
create table public.places (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 120),
  address     text check (address is null or char_length(address) <= 300),
  category_id uuid,
  notes       text check (notes is null or char_length(notes) <= 1000),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  foreign key (category_id, user_id) references public.categories (id, user_id)
);

create unique index places_user_name_key on public.places (user_id, lower(btrim(name)));
create index places_user_id_idx on public.places (user_id);

-- ── 2. budgets ───────────────────────────────────────────────
-- category_id NULL = presupuesto global (todos los gastos del periodo).
create table public.budgets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  category_id uuid,
  period      text not null default 'monthly' check (period in ('weekly', 'monthly', 'yearly')),
  amount      numeric(12, 2) not null check (amount > 0),
  currency    text not null default 'EUR',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  foreign key (category_id, user_id) references public.categories (id, user_id)
);

-- Un solo presupuesto activo por (usuario, categoría, periodo)
create unique index budgets_one_active_key on public.budgets (
  user_id,
  coalesce(category_id, '00000000-0000-0000-0000-000000000000'::uuid),
  period
) where is_active;
create index budgets_user_id_idx on public.budgets (user_id);

-- ── 3. ai_usage (cuota diaria del asistente IA) ──────────────
-- El usuario solo puede LEER su uso. Escribir (incrementar) es cosa del servidor,
-- para que nadie pueda resetearse su propia cuota.
create table public.ai_usage (
  user_id    uuid not null references auth.users (id) on delete cascade,
  day        date not null default current_date,
  requests   int  not null default 0 check (requests >= 0),
  tokens_in  int  not null default 0 check (tokens_in >= 0),
  tokens_out int  not null default 0 check (tokens_out >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

-- ── 4. Triggers updated_at ───────────────────────────────────
create trigger trg_places_updated_at   before update on public.places
  for each row execute function public.handle_updated_at();
create trigger trg_budgets_updated_at  before update on public.budgets
  for each row execute function public.handle_updated_at();
create trigger trg_ai_usage_updated_at before update on public.ai_usage
  for each row execute function public.handle_updated_at();

-- ── 5. RLS ───────────────────────────────────────────────────
alter table public.places   enable row level security;
alter table public.budgets  enable row level security;
alter table public.ai_usage enable row level security;

-- places
create policy places_select_own on public.places for select to authenticated
  using ((select auth.uid()) = user_id);
create policy places_insert_own on public.places for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy places_update_own on public.places for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy places_delete_own on public.places for delete to authenticated
  using ((select auth.uid()) = user_id);

-- budgets
create policy budgets_select_own on public.budgets for select to authenticated
  using ((select auth.uid()) = user_id);
create policy budgets_insert_own on public.budgets for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy budgets_update_own on public.budgets for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy budgets_delete_own on public.budgets for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ai_usage: solo lectura propia (sin políticas de insert/update/delete)
create policy ai_usage_select_own on public.ai_usage for select to authenticated
  using ((select auth.uid()) = user_id);

-- ── 6. Permisos de tabla (mínimo necesario) ──────────────────
revoke all on public.places, public.budgets, public.ai_usage from anon, authenticated;
grant select, insert, update, delete on public.places, public.budgets to authenticated;
grant select on public.ai_usage to authenticated;

-- ── 7. Contador de uso de IA: solo service_role (servidor) ───
create or replace function public.register_ai_usage(
  p_user_id uuid, p_tokens_in int default 0, p_tokens_out int default 0
) returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_requests int;
begin
  insert into public.ai_usage as u (user_id, day, requests, tokens_in, tokens_out)
  values (p_user_id, current_date, 1, greatest(p_tokens_in, 0), greatest(p_tokens_out, 0))
  on conflict (user_id, day) do update set
    requests   = u.requests + 1,
    tokens_in  = u.tokens_in + greatest(p_tokens_in, 0),
    tokens_out = u.tokens_out + greatest(p_tokens_out, 0)
  returning u.requests into v_requests;
  return v_requests;
end;
$$;

revoke execute on function public.register_ai_usage(uuid, int, int) from public, anon, authenticated;
grant  execute on function public.register_ai_usage(uuid, int, int) to service_role;
