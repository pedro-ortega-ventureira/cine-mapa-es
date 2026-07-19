-- Allow professionals to self-register and manage their own profile without
-- admin intervention. A professional row can now be linked to an auth.users
-- account via user_id; ownership is enforced both by RLS (defense in depth
-- for any direct REST access) and by the server functions in
-- src/lib/public-registration.functions.ts (which use the service-role
-- client with an explicit user_id = context.userId check, the same pattern
-- already used for the admin-only functions in professionals.functions.ts).

ALTER TABLE public.professionals
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- One self-managed profile per account (admin-created/imported rows keep user_id NULL,
-- and NULLs are not considered duplicates by a unique index).
CREATE UNIQUE INDEX IF NOT EXISTS professionals_user_id_key
  ON public.professionals(user_id)
  WHERE user_id IS NOT NULL;

CREATE POLICY "Users can insert their own professional profile"
  ON public.professionals FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own professional profile"
  ON public.professionals FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
