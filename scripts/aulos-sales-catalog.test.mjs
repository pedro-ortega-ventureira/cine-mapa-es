import test from 'node:test';
import assert from 'node:assert/strict';

import {
  COLLECTIONS,
  buildHeroModel,
  normalizeCatalogState,
  renderSalesCatalog,
  selectCollectionProducts,
} from './lib/aulos-sales-catalog.mjs';
import {
  assertRemoteUnchanged,
  buildElementorActions,
  executePublicationMode,
  redactSecrets,
  validateStagingUrl,
} from './publish-aulos-sales-catalog.mjs';

const categoryFixtures = [
  { id: 11, name: 'Aulós Humanidades', slug: 'aulos-humanidades', count: 2 },
  { id: 12, name: 'Aulós Digital', slug: 'aulos-digital', count: 1 },
  { id: 13, name: 'Aulós Academics', slug: 'aulos-academics', count: 0 },
  { id: 14, name: 'Packs', slug: 'packs', count: 1 },
  { id: 15, name: 'Herejía y Belleza', slug: 'herejia-y-belleza', count: 1 },
  { id: 16, name: 'Mistérica', slug: 'misterica', count: 1 },
  { id: 17, name: 'Catálogos', slug: 'catalogos', count: 1 },
];

const productFixtures = [
  {
    id: 6197,
    name: 'La vanguardia prerrafaelista',
    slug: 'la-vanguardia-prerrafaelista',
    permalink: 'https://staging8.aulos.es/producto/la-vanguardia-prerrafaelista/',
    status: 'publish',
    catalog_visibility: 'visible',
    purchasable: true,
    type: 'simple',
    price_html: '<span class="woocommerce-Price-amount amount">30 €</span>',
    short_description: '<p>Un estudio sobre los lenguajes y protagonistas del prerrafaelismo.</p>',
    date_created: '2026-02-01T10:00:00',
    images: [{ src: 'https://example.test/prerrafaelista.jpg', alt: 'Portada de La vanguardia prerrafaelista' }],
    categories: [{ id: 11, name: 'Aulós Humanidades', slug: 'aulos-humanidades' }],
    meta_data: [{ key: 'autor', value: 'Pedro Ortega Ventureira' }],
  },
  {
    id: 7001,
    name: 'Humanidades anteriores',
    slug: 'humanidades-anteriores',
    permalink: 'https://staging8.aulos.es/producto/humanidades-anteriores/',
    status: 'publish',
    catalog_visibility: 'visible',
    purchasable: true,
    type: 'simple',
    price_html: '<span>20 €</span>',
    date_created: '2025-01-01T10:00:00',
    images: [{ src: 'https://example.test/humanidades.jpg', alt: '' }],
    categories: [{ id: 11, name: 'Aulós Humanidades', slug: 'aulos-humanidades' }],
    meta_data: [],
  },
  {
    id: 7002,
    name: 'Arteficial',
    slug: 'arteficial',
    permalink: 'https://staging8.aulos.es/producto/arteficial/',
    status: 'publish',
    catalog_visibility: 'visible',
    purchasable: true,
    type: 'simple',
    price_html: '<span>15 €</span>',
    date_created: '2026-01-10T10:00:00',
    images: [{ src: 'https://example.test/arteficial.jpg', alt: 'Portada de Arteficial' }],
    categories: [{ id: 12, name: 'Aulós Digital', slug: 'aulos-digital' }],
    meta_data: [],
  },
  {
    id: 7003,
    name: 'Pack editorial',
    slug: 'pack-editorial',
    permalink: 'https://staging8.aulos.es/producto/pack-editorial/',
    status: 'publish',
    catalog_visibility: 'visible',
    purchasable: false,
    type: 'external',
    external_url: 'https://example.org/pack',
    price_html: '<span>40 €</span>',
    date_created: '2026-01-08T10:00:00',
    images: [{ src: 'https://example.test/pack.jpg', alt: 'Pack editorial' }],
    categories: [{ id: 14, name: 'Packs', slug: 'packs' }],
    meta_data: [],
  },
];

test('orders collections and omits empty collections without reordering the rest', () => {
  const state = normalizeCatalogState(productFixtures, categoryFixtures);
  const groups = selectCollectionProducts(state, COLLECTIONS, 4);

  assert.deepEqual(
    groups.map((group) => group.name),
    ['Aulós Humanidades', 'Aulós Digital', 'Packs'],
  );
  assert.deepEqual(
    groups[0].products.map((product) => product.id),
    [6197, 7001],
  );
});

test('excludes drafts, hidden products and products outside approved collections', () => {
  const state = normalizeCatalogState(
    [
      ...productFixtures,
      { ...productFixtures[1], id: 8001, status: 'draft' },
      { ...productFixtures[1], id: 8002, catalog_visibility: 'hidden' },
      {
        ...productFixtures[1],
        id: 8003,
        categories: [{ id: 99, name: 'Sin ordenar', slug: 'sin-ordenar' }],
      },
    ],
    categoryFixtures,
  );

  assert.deepEqual(
    selectCollectionProducts(state, COLLECTIONS, 4).flatMap((group) => group.products.map((product) => product.id)),
    [6197, 7001, 7002, 7003],
  );
});

test('builds the product 6197 hero with cart CTA only when internally purchasable', () => {
  const purchasable = buildHeroModel(productFixtures[0]);
  const external = buildHeroModel(productFixtures[3]);

  assert.equal(purchasable.id, 6197);
  assert.equal(purchasable.author, 'Pedro Ortega Ventureira');
  assert.equal(purchasable.addToCartUrl, 'https://staging8.aulos.es/?add-to-cart=6197');
  assert.equal(external.addToCartUrl, null);
});

test('renders an editorial sales page with semantic headings and no invented author', () => {
  const state = normalizeCatalogState(productFixtures, categoryFixtures);
  const html = renderSalesCatalog({
    hero: buildHeroModel(productFixtures[0]),
    collections: selectCollectionProducts(state, COLLECTIONS, 4),
  });

  assert.equal((html.match(/<h1\b/g) ?? []).length, 1);
  assert.match(html, /<h1[^>]*>La vanguardia prerrafaelista<\/h1>/);
  assert.match(html, />Ver edición</);
  assert.match(html, />Añadir al carrito</);
  assert.doesNotMatch(html, /Autor desconocido/);
  assert.match(html, /Aulós Humanidades[\s\S]*Aulós Digital[\s\S]*Packs/);
  assert.match(html, /#F5F2EC/i);
  assert.match(html, /#171717/i);
  assert.match(html, /#6D1F2C/i);
  assert.match(html, /min-height:\s*44px/);
  assert.match(html, /:focus-visible/);
  assert.match(html, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.match(html, /\.aulos-catalog--paper\s+:is\(h1,h2,h3\)\s*\{[^}]*color:\s*var\(--aulos-ink\)/s);
  assert.match(html, /@media\s*\(max-width:\s*767px\)/);
});

test('rejects every publication host except the authorized staging host', () => {
  assert.equal(validateStagingUrl('https://staging8.aulos.es/catalogo/').hostname, 'staging8.aulos.es');
  assert.throws(() => validateStagingUrl('https://aulos.es/catalogo/'), /staging8\.aulos\.es/);
  assert.throws(() => validateStagingUrl('https://staging8.aulos.es.evil.test/catalogo/'), /staging8\.aulos\.es/);
});

test('redacts every configured secret from diagnostic errors', () => {
  const secrets = ['basic-secret', 'wp-secret', 'nonce-secret'];
  const message = redactSecrets('Failed basic-secret wp-secret nonce-secret', secrets);

  assert.equal(message, 'Failed [REDACTED] [REDACTED] [REDACTED]');
});

test('builds one idempotent Elementor document around the rendered catalogue', () => {
  const first = buildElementorActions('<main class="aulos-catalog">Catálogo</main>', {
    title: 'Catálogo',
    status: 'publish',
  });
  const second = buildElementorActions('<main class="aulos-catalog">Catálogo</main>', {
    title: 'Catálogo',
    status: 'publish',
  });

  assert.deepEqual(first, second);
  assert.equal(first.save_builder.data.elements.length, 1);
  assert.equal(first.save_builder.data.elements[0].elements[0].widgetType, 'html');
  assert.match(first.save_builder.data.elements[0].elements[0].settings.html, /aulos-catalog/);
});

test('stops publication when the remote Elementor document changed after reading', () => {
  assert.doesNotThrow(() => assertRemoteUnchanged('sha-a', 'sha-a'));
  assert.throws(() => assertRemoteUnchanged('sha-a', 'sha-b'), /cambió/);
});

test('dry run retrieves state without calling any write operation', async () => {
  const calls = [];
  const client = {
    async fetchCatalog() {
      calls.push('fetchCatalog');
      return { products: productFixtures, categories: categoryFixtures };
    },
    async fetchPage() {
      calls.push('fetchPage');
      return null;
    },
    async createPage() {
      calls.push('createPage');
    },
    async saveElementor() {
      calls.push('saveElementor');
    },
  };

  const result = await executePublicationMode('--dry-run', client);

  assert.deepEqual(calls, ['fetchCatalog', 'fetchPage']);
  assert.equal(result.heroId, 6197);
  assert.equal(result.writes, 0);
});
