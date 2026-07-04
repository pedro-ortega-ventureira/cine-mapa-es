INSERT INTO public.user_roles (user_id, role)
VALUES ('4ce75920-c2fa-4f0a-9cc8-bd3468d8ee6f', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;