-- WESLLEN IMPORTS: execute SOMENTE este arquivo em uma NOVA consulta do SQL Editor.
-- Requer a migração 001 (wesllen_catalog). Não requer as migrações 002 ou 003.
-- Remove apenas o trigger defeituoso das tentativas anteriores, caso exista.
-- Acrescenta as seleções ausentes ao JSON do catálogo sem alterar produtos ou dados existentes.

drop trigger if exists wesllen_catalog_team_index on public.wesllen_catalog;

update public.wesllen_catalog as catalog
set document = jsonb_set(
  catalog.document,
  '{categories}',
  coalesce(catalog.document->'categories', '[]'::jsonb) ||
  (
    select coalesce(jsonb_agg(
      jsonb_build_object('logo_url','','league','','category','Seleções','is_active',true,'show_on_home',true)
      || preset.team_document order by preset.position
    ), '[]'::jsonb)
    from jsonb_array_elements($teams$
    [
      {"id":"selecao-brasil","name":"Brasil","slug":"selecao-brasil","country":"Brasil","sort_order":143},
      {"id":"selecao-argentina","name":"Argentina","slug":"selecao-argentina","country":"Argentina","sort_order":144},
      {"id":"selecao-franca","name":"França","slug":"selecao-franca","country":"França","sort_order":145},
      {"id":"selecao-alemanha","name":"Alemanha","slug":"selecao-alemanha","country":"Alemanha","sort_order":146},
      {"id":"selecao-espanha","name":"Espanha","slug":"selecao-espanha","country":"Espanha","sort_order":147},
      {"id":"selecao-inglaterra","name":"Inglaterra","slug":"selecao-inglaterra","country":"Inglaterra","sort_order":148},
      {"id":"selecao-portugal","name":"Portugal","slug":"selecao-portugal","country":"Portugal","sort_order":149},
      {"id":"selecao-italia","name":"Itália","slug":"selecao-italia","country":"Itália","sort_order":150},
      {"id":"selecao-paises-baixos","name":"Países Baixos","slug":"selecao-paises-baixos","country":"Países Baixos","sort_order":151},
      {"id":"selecao-uruguai","name":"Uruguai","slug":"selecao-uruguai","country":"Uruguai","sort_order":152},
      {"id":"selecao-croacia","name":"Croácia","slug":"selecao-croacia","country":"Croácia","sort_order":153},
      {"id":"selecao-belgica","name":"Bélgica","slug":"selecao-belgica","country":"Bélgica","sort_order":154},
      {"id":"selecao-estados-unidos","name":"Estados Unidos","slug":"selecao-estados-unidos","country":"Estados Unidos","sort_order":155},
      {"id":"selecao-mexico","name":"México","slug":"selecao-mexico","country":"México","sort_order":156},
      {"id":"selecao-japao","name":"Japão","slug":"selecao-japao","country":"Japão","sort_order":157},
      {"id":"selecao-marrocos","name":"Marrocos","slug":"selecao-marrocos","country":"Marrocos","sort_order":158}
    ]
    $teams$::jsonb) with ordinality as preset(team_document,position)
    where not exists (
      select 1
      from jsonb_array_elements(coalesce(catalog.document->'categories', '[]'::jsonb)) as saved(team_document)
      where saved.team_document->>'id' = preset.team_document->>'id'
         or saved.team_document->>'slug' = preset.team_document->>'slug'
         or (saved.team_document->>'category' = 'Seleções'
             and saved.team_document->>'name' = preset.team_document->>'name')
    )
  ),
  true
),
updated_at = now()
where catalog.id = 1;

select count(*) as selecoes_cadastradas
from public.wesllen_catalog as catalog,
     jsonb_array_elements(coalesce(catalog.document->'categories', '[]'::jsonb)) as team(team_document)
where catalog.id = 1
  and team.team_document->>'id' like 'selecao-%';
