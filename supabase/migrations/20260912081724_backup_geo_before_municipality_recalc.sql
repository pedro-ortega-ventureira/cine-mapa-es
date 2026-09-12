create table if not exists public.geo_backup_20260912 (
  professional_id uuid primary key references public.professionals(id) on delete cascade,
  slug text,
  raw_postal_code text,
  municipality_code text,
  geo_lat double precision,
  geo_lng double precision,
  geo_accuracy text,
  geo_municipality_name text,
  geo_province text,
  motivo text,
  created_at timestamptz not null default now()
);

alter table public.geo_backup_20260912 enable row level security;

drop policy if exists "Admins manage geo backup" on public.geo_backup_20260912;
create policy "Admins manage geo backup"
  on public.geo_backup_20260912
  for all to authenticated
  using (has_role(auth.uid(), 'admin'::app_role))
  with check (has_role(auth.uid(), 'admin'::app_role));
