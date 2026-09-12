-- 'municipio' = coordenadas del centro del municipio elegido (no de la dirección exacta).
alter table public.professionals drop constraint if exists professionals_geo_accuracy_check;
alter table public.professionals add constraint professionals_geo_accuracy_check
  check (geo_accuracy = any (array['exact','municipio','province','none']));

create or replace function public.fill_geo_from_municipality()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  m record;
begin
  if new.municipality_code is null then
    return new;
  end if;

  -- Rellena cuando el alta no trae coordenadas, o cuando se cambia de municipio
  -- sin aportar coordenadas nuevas en la misma operación.
  if new.geo_lat is null or new.geo_lng is null
     or (tg_op = 'UPDATE'
         and new.municipality_code is distinct from old.municipality_code
         and new.geo_lat is not distinct from old.geo_lat
         and new.geo_lng is not distinct from old.geo_lng) then

    select name, province, lat, lng into m
    from public.municipalities
    where code = new.municipality_code;

    if m.lat is not null then
      new.geo_lat := m.lat;
      new.geo_lng := m.lng;
      new.geo_municipality_name := m.name;
      new.geo_province := m.province;
      new.geo_accuracy := 'municipio';
    end if;
  end if;

  return new;
end $function$;

drop trigger if exists trg_professionals_geo on public.professionals;
create trigger trg_professionals_geo
  before insert or update on public.professionals
  for each row execute function public.fill_geo_from_municipality();
