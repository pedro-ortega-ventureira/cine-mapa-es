-- Ya existía professionals_user_id_key con la misma definición; este índice era redundante.
drop index if exists public.professionals_user_id_unique;
