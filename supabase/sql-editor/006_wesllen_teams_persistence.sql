-- Persistência de times. Não altera o documento do catálogo nem os produtos.
-- Execute no SQL Editor do projeto usado pela Vercel.
begin;

-- Uma migração antiga criou este gatilho; ele não deve reescrever o JSON do catálogo.
drop trigger if exists wesllen_catalog_team_index on public.wesllen_catalog;

alter table public.wesllen_catalog enable row level security;
revoke all on public.wesllen_catalog from public, anon, authenticated;
grant usage on schema public to service_role;
grant select, insert, update on public.wesllen_catalog to service_role;

commit;

select c.relname as tabela, c.relrowsecurity as rls_ativo,
       has_table_privilege('service_role', c.oid, 'SELECT') as leitura_servico,
       has_table_privilege('service_role', c.oid, 'UPDATE') as escrita_servico,
       (select count(*) from pg_trigger t where t.tgrelid = c.oid and not t.tgisinternal) as gatilhos_customizados
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'wesllen_catalog';
