BEGIN;
SELECT plan(8);

SELECT col_type_is(
  'public', 'contact_messages', 'email_payload', 'jsonb',
  'email payload is persisted as JSONB'
);
SELECT col_type_is(
  'public', 'contact_messages', 'email_id', 'text',
  'Resend email id is persisted'
);
SELECT col_type_is(
  'public', 'contact_messages', 'email_accepted_at', 'timestamp with time zone',
  'acceptance time is persisted'
);
SELECT ok(
  NOT has_table_privilege('anon', 'public.contact_messages', 'INSERT'),
  'anon cannot insert contact messages directly'
);
SELECT ok(
  NOT has_table_privilege('authenticated', 'public.contact_messages', 'INSERT'),
  'authenticated cannot insert contact messages directly'
);
SELECT ok(
  has_function_privilege(
    'service_role',
    'public.reserve_contact_message(uuid,uuid,text,text,text,text,timestamp with time zone,jsonb,timestamp with time zone)',
    'EXECUTE'
  ),
  'service role can reserve a contact atomically'
);
SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.reserve_contact_message(uuid,uuid,text,text,text,text,timestamp with time zone,jsonb,timestamp with time zone)',
    'EXECUTE'
  ),
  'anon cannot call the reservation function'
);
SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'public.reserve_contact_message(uuid,uuid,text,text,text,text,timestamp with time zone,jsonb,timestamp with time zone)',
    'EXECUTE'
  ),
  'authenticated cannot call the reservation function'
);

SELECT * FROM finish();
ROLLBACK;
