-- Execute antes de publicar a API de confirmação de vendas.
-- O catálogo continua sendo a fonte de verdade. A view expõe as variações sem
-- inventar quantidades para produtos antigos que ainda não foram configurados.
create or replace view public.wesllen_product_variants as
select product->>'id' as product_id,
       size_entry.key as size,
       (size_entry.value #>> '{}')::integer as quantity_available,
       ((size_entry.value #>> '{}')::integer > 0) as available
from public.wesllen_catalog catalog
cross join lateral jsonb_array_elements(catalog.document->'products') product
cross join lateral jsonb_each(case when jsonb_typeof(product->'sizeStock') = 'object' then product->'sizeStock' else '{}'::jsonb end) size_entry
where catalog.id = 1;

create table if not exists public.wesllen_sales (
  id uuid primary key,
  quote_id uuid unique references public.wesllen_quotes(id),
  items jsonb not null,
  confirmed_at timestamptz not null default now()
);
create index if not exists wesllen_sales_confirmed_at_idx on public.wesllen_sales (confirmed_at desc);
alter table public.wesllen_sales enable row level security;
revoke all on public.wesllen_sales from public, anon, authenticated;
revoke all on public.wesllen_product_variants from public, anon, authenticated;
grant select, insert on public.wesllen_sales to service_role;
grant select on public.wesllen_product_variants to service_role;

create or replace function public.wesllen_confirm_sale(p_id uuid, p_quote_id uuid, p_items jsonb)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  current_document jsonb;
  next_document jsonb;
  item jsonb;
  product_index integer;
  product jsonb;
  current_stock integer;
  quantity integer;
  size_name text;
  product_id text;
  existing_sale public.wesllen_sales%rowtype;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Itens da venda inválidos.';
  end if;
  -- Uma única linha bloqueada serializa baixas e edições do catálogo.
  select document into current_document from public.wesllen_catalog where id = 1 for update;
  if current_document is null then raise exception 'Catálogo não encontrado.'; end if;
  select * into existing_sale from public.wesllen_sales where id = p_id or (p_quote_id is not null and quote_id = p_quote_id);
  if found then
    if existing_sale.id <> p_id or existing_sale.quote_id is distinct from p_quote_id or existing_sale.items <> p_items then
      raise exception 'Esta venda já foi confirmada com outros dados.';
    end if;
    return jsonb_build_object('alreadyConfirmed', true, 'id', p_id);
  end if;
  next_document := current_document;
  for item in select value from jsonb_array_elements(p_items) loop
    product_id := item->>'productId';
    size_name := coalesce(item->>'size', '');
    if (item->>'quantity') !~ '^[1-9][0-9]*$' then raise exception 'Quantidade inválida.'; end if;
    quantity := (item->>'quantity')::integer;
    if quantity > 99 then raise exception 'Quantidade inválida.'; end if;
    select (ordinality - 1)::integer into product_index
      from jsonb_array_elements(next_document->'products') with ordinality as products(value, ordinality)
      where value->>'id' = product_id limit 1;
    if product_index is null then raise exception 'Produto não encontrado.'; end if;
    product := next_document #> array['products', product_index::text];
    if size_name <> '' then
      if not (product->'sizes' ? size_name) or not (product->'sizeStock' ? size_name) then
        raise exception 'Tamanho não cadastrado.';
      end if;
      current_stock := (product->'sizeStock'->>size_name)::integer;
      if current_stock < quantity then raise exception 'Estoque insuficiente para o tamanho %.', size_name; end if;
      product := jsonb_set(product, array['sizeStock',size_name], to_jsonb(current_stock - quantity));
      select sum(value::integer) into current_stock from jsonb_each_text(product->'sizeStock');
      product := jsonb_set(product, '{stock}', to_jsonb(current_stock));
    else
      if product->>'stock' is null then continue; end if;
      current_stock := (product->>'stock')::integer;
      if current_stock < quantity then raise exception 'Estoque insuficiente.'; end if;
      product := jsonb_set(product, '{stock}', to_jsonb(current_stock - quantity));
    end if;
    next_document := jsonb_set(next_document, array['products',product_index::text], product);
    product_index := null;
  end loop;
  update public.wesllen_catalog
    set document = next_document,
        updated_at = greatest(clock_timestamp(), updated_at + interval '1 microsecond')
    where id = 1;
  insert into public.wesllen_sales(id, quote_id, items) values (p_id, p_quote_id, p_items);
  return jsonb_build_object('alreadyConfirmed', false, 'id', p_id);
end;
$$;
revoke all on function public.wesllen_confirm_sale(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.wesllen_confirm_sale(uuid, uuid, jsonb) to service_role;
