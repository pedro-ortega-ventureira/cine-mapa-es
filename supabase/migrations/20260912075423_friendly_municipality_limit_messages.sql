create or replace function public.check_municipio_menor_20k()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  m record;
begin
  if tg_op = 'INSERT' and new.municipality_code is null then
    raise exception 'Selecciona un municipio para continuar. El mapa solo admite altas en municipios de menos de 20.000 habitantes.'
      using errcode = 'P0001', hint = 'municipality_code';
  end if;

  if new.municipality_code is not null then
    select name, province, population into m
    from public.municipalities
    where code = new.municipality_code;

    if m is null then
      raise exception 'El municipio seleccionado no figura en el listado oficial. Vuelve a elegirlo en el desplegable.'
        using errcode = 'P0001', hint = 'municipality_code';
    end if;

    if m.population >= 20000 then
      raise exception '% (%) tiene % habitantes. El mapa solo admite municipios de menos de 20.000 habitantes.', m.name, m.province, to_char(m.population, 'FM999G999')
        using errcode = 'P0001', hint = 'municipality_code';
    end if;
  end if;

  return new;
end $function$;
