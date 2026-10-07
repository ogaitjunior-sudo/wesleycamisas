-- WESLLEN IMPORTS: cole este arquivo no SQL Editor do projeto Supabase.
-- O navegador acessa somente o servidor da loja. Nenhuma tabela recebe acesso anon/authenticated.

create table if not exists public.wesllen_catalog (
  id smallint primary key check (id = 1),
  document jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.wesllen_quotes (
  id uuid primary key,
  created_at timestamptz not null default now(),
  payload jsonb not null
);

create index if not exists wesllen_quotes_created_at_idx
  on public.wesllen_quotes (created_at desc);

alter table public.wesllen_catalog enable row level security;
alter table public.wesllen_quotes enable row level security;

revoke all on public.wesllen_catalog from public, anon, authenticated;
revoke all on public.wesllen_quotes from public, anon, authenticated;
grant usage on schema public to service_role;
grant select, insert, update on public.wesllen_catalog to service_role;
grant select, insert on public.wesllen_quotes to service_role;

-- Conferência: as duas linhas devem mostrar rowsecurity = true.
select tablename, rowsecurity
from pg_tables
where schemaname = 'public' and tablename in ('wesllen_catalog', 'wesllen_quotes')
order by tablename;
