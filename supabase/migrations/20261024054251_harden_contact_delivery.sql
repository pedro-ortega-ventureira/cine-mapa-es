ALTER TABLE public.contact_messages
  ADD COLUMN email_payload JSONB,
  ADD COLUMN email_id TEXT,
  ADD COLUMN email_accepted_at TIMESTAMPTZ;

REVOKE INSERT ON TABLE public.contact_messages FROM anon, authenticated;
DROP POLICY IF EXISTS "Anyone can send messages" ON public.contact_messages;

CREATE OR REPLACE FUNCTION public.reserve_contact_message(
  p_id UUID,
  p_professional_id UUID,
  p_sender_name TEXT,
  p_sender_email TEXT,
  p_subject TEXT,
  p_message TEXT,
  p_created_at TIMESTAMPTZ,
  p_email_payload JSONB,
  p_since TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  existing public.contact_messages%ROWTYPE;
  stored public.contact_messages%ROWTYPE;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_id::TEXT, 0));

  SELECT * INTO existing
  FROM public.contact_messages
  WHERE id = p_id;

  IF FOUND THEN
    IF existing.professional_id IS NOT DISTINCT FROM p_professional_id
      AND existing.sender_name IS NOT DISTINCT FROM p_sender_name
      AND existing.sender_email IS NOT DISTINCT FROM p_sender_email
      AND existing.subject IS NOT DISTINCT FROM p_subject
      AND existing.message IS NOT DISTINCT FROM p_message
      AND existing.email_payload IS NOT NULL
    THEN
      RETURN pg_catalog.jsonb_build_object(
        'status', 'duplicate_same',
        'contact', pg_catalog.jsonb_build_object(
          'request_id', existing.id,
          'professional_id', existing.professional_id,
          'sender_name', existing.sender_name,
          'sender_email', existing.sender_email,
          'subject', COALESCE(existing.subject, ''),
          'message', existing.message,
          'created_at', existing.created_at,
          'email_payload', existing.email_payload,
          'email_id', existing.email_id
        )
      );
    END IF;

    RETURN pg_catalog.jsonb_build_object('status', 'conflict', 'contact', NULL);
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(pg_catalog.lower(pg_catalog.btrim(p_sender_email)), 1)
  );

  IF (
    SELECT pg_catalog.count(*)
    FROM public.contact_messages
    WHERE sender_email = p_sender_email
      AND created_at >= p_since
  ) >= 5 THEN
    RETURN pg_catalog.jsonb_build_object('status', 'rate_limited', 'contact', NULL);
  END IF;

  INSERT INTO public.contact_messages (
    id,
    professional_id,
    sender_name,
    sender_email,
    subject,
    message,
    created_at,
    email_payload
  ) VALUES (
    p_id,
    p_professional_id,
    p_sender_name,
    p_sender_email,
    p_subject,
    p_message,
    p_created_at,
    p_email_payload
  )
  RETURNING * INTO stored;

  RETURN pg_catalog.jsonb_build_object(
    'status', 'new',
    'contact', pg_catalog.jsonb_build_object(
      'request_id', stored.id,
      'professional_id', stored.professional_id,
      'sender_name', stored.sender_name,
      'sender_email', stored.sender_email,
      'subject', COALESCE(stored.subject, ''),
      'message', stored.message,
      'created_at', stored.created_at,
      'email_payload', stored.email_payload,
      'email_id', stored.email_id
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_contact_message(
  UUID, UUID, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, JSONB, TIMESTAMPTZ
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_contact_message(
  UUID, UUID, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, JSONB, TIMESTAMPTZ
) TO service_role;
