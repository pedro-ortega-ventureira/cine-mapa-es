-- Cada usuario debe poder leer su propia ficha aunque no esté verificada ni activa.
-- Sin esto, el alta graba la fila pero el frontend recibe 0 filas al hacer .select() y muestra error.
drop policy if exists "Users can view their own professional profile" on public.professionals;
create policy "Users can view their own professional profile"
  on public.professionals
  for select
  to authenticated
  using (user_id = auth.uid());

-- Una cuenta = una ficha (evita duplicados por reintentos del formulario).
create unique index if not exists professionals_user_id_unique
  on public.professionals (user_id)
  where user_id is not null;
