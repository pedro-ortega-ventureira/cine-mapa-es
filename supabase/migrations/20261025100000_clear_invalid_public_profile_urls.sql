-- Remove only values audited as syntactically invalid or non-image URLs.
-- NULL keeps the profile usable and lets the UI render its fallback state.
UPDATE public.professionals
SET photo_url = NULL
WHERE slug IN (
  'adonai-garcia-chd3',
  'javier-olivera-bqge',
  'jeronimo-garcia-castela-gr1q',
  'ruben-dario-ortega-martin-5cqq'
);

UPDATE public.professionals
SET website = NULL
WHERE slug IN ('adonai-garcia-chd3', 'javier-olivera-bqge');
