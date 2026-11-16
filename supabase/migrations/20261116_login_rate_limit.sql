-- Límite de intentos de login (lo usa src/app/(auth)/login/actions.ts).
-- Solo accesible con la Service Role Key (servidor): RLS activado sin políticas
-- y funciones ejecutables únicamente por service_role.
-- Si esta migración no está aplicada, la server action cae a un límite en
-- memoria (menos fiable en Workers) y el login sigue funcionando.

create table if not exists public.auth_rate_limits (
  key          text primary key,
  failures     int not null default 0,
  window_start timestamptz not null default now()
);

alter table public.auth_rate_limits enable row level security;
revoke all on public.auth_rate_limits from anon, authenticated;

-- Suma un fallo (reinicia la ventana si caducó) y devuelve el total actual.
create or replace function public.register_login_failure(p_key text, p_window_seconds int)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_failures int;
begin
  insert into public.auth_rate_limits as r (key, failures, window_start)
  values (p_key, 1, now())
  on conflict (key) do update set
    failures = case
      when r.window_start < now() - make_interval(secs => p_window_seconds) then 1
      else r.failures + 1
    end,
    window_start = case
      when r.window_start < now() - make_interval(secs => p_window_seconds) then now()
      else r.window_start
    end
  returning r.failures into v_failures;
  return v_failures;
end;
$$;

-- Fallos vigentes dentro de la ventana (0 si no hay o caducó).
create or replace function public.get_login_failures(p_key text, p_window_seconds int)
returns int
language sql
security definer
set search_path = ''
as $$
  select coalesce(
    (select r.failures from public.auth_rate_limits r
      where r.key = p_key
        and r.window_start >= now() - make_interval(secs => p_window_seconds)),
    0
  );
$$;

create or replace function public.clear_login_failures(p_key text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.auth_rate_limits where key = p_key;
$$;

revoke execute on function public.register_login_failure(text, int) from public, anon, authenticated;
revoke execute on function public.get_login_failures(text, int)     from public, anon, authenticated;
revoke execute on function public.clear_login_failures(text)        from public, anon, authenticated;
grant  execute on function public.register_login_failure(text, int) to service_role;
grant  execute on function public.get_login_failures(text, int)     to service_role;
grant  execute on function public.clear_login_failures(text)        to service_role;
