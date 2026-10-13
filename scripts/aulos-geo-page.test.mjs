import test from 'node:test';
import assert from 'node:assert/strict';

import {
  REQUIRED_PRODUCT_TITLES,
  productSearchTitle,
  renderAulosGeoPage,
  selectRequiredProducts,
} from './lib/aulos-geo-page.mjs';
import {
  assertRemoteUnchanged,
  buildGeoElementorActions,
  fetchRequiredProducts,
  validateStagingUrl,
} from './publish-aulos-geo-page.mjs';

const products = [
  {
    name: ' La   vanguardia prerrafaelista ',
    permalink: 'https://staging8.aulos.es/producto/la-vanguardia-prerrafaelista/',
    status: 'publish',
  },
  {
    name: 'Leer la Luna. Tarot y cine',
    permalink: 'https://staging8.aulos.es/producto/leer-la-luna-tarot-y-cine-carlos-a-cuellar-alejandro/',
    status: 'publish',
  },
  {
    name: 'Patrimonio Digital',
    permalink: 'https://staging8.aulos.es/producto/patrimonio-digital/',
    status: 'publish',
  },
  {
    name: 'La conquista de Portugal. Historia e iconografía',
    permalink: 'https://staging8.aulos.es/producto/la-conquista-de-portugal/',
    status: 'publish',
  },
];

test('selectRequiredProducts preserves the approved title order despite whitespace', () => {
  assert.deepEqual(REQUIRED_PRODUCT_TITLES, [
    'La vanguardia prerrafaelista',
    'Leer la Luna. Tarot y cine',
    'Patrimonio Digital',
    'La conquista de Portugal. Historia e iconografía',
  ]);
  assert.deepEqual(
    selectRequiredProducts([...products].reverse()).map((product) => product.name),
    REQUIRED_PRODUCT_TITLES,
  );
});

test('selectRequiredProducts rejects a missing fourth approved title', () => {
  assert.throws(
    () => selectRequiredProducts(products.slice(0, -1)),
    /La conquista de Portugal\. Historia e iconografía/,
  );
});

test('selectRequiredProducts displays the approved Portugal title while linking its published edition', () => {
  const liveProducts = products.map((product) => product.name === 'La conquista de Portugal. Historia e iconografía'
    ? { ...product, name: 'La conquista de Portugal' }
    : product);
  const selected = selectRequiredProducts(liveProducts);

  assert.equal(selected[3].name, 'La conquista de Portugal. Historia e iconografía');
  assert.equal(selected[3].permalink, 'https://staging8.aulos.es/producto/la-conquista-de-portugal/');
});

test('selectRequiredProducts accepts WooCommerce Store API products without an explicit status', () => {
  const selected = selectRequiredProducts(products.map(({ status, ...product }) => product));
  assert.equal(selected.length, 4);
});

test('renderAulosGeoPage renders the approved content with internal product routes', () => {
  const selected = selectRequiredProducts(products);
  const html = renderAulosGeoPage(selected);

  assert.equal((html.match(/<h1\b/g) ?? []).length, 1);
  assert.match(html, /<h1[^>]*>Libros que piden otra forma de leer<\/h1>/);
  assert.match(html, />Criterio editorial</);
  assert.match(html, /<h2[^>]*>Cómo elegir un libro Aulós<\/h2>/);
  assert.match(html, /<h2[^>]*>Cuatro puertas de entrada<\/h2>/);
  assert.match(html, /href="\/catalogo\/"/);
  assert.doesNotMatch(html, /utm_/i);
  assert.doesNotMatch(html, /NOMBRE_COMPETIDOR/);
  assert.match(html, /#F5F2EC/i);
  assert.match(html, /#6D1F2C/i);
  assert.match(html, /font-family:[^;]*Georgia/i);
  for (const product of selected) {
    assert.ok(html.includes(product.permalink));
  }
});

test('publisher refuses production URLs and protects changed Elementor documents', () => {
  assert.throws(() => validateStagingUrl('https://aulos.es/'), /staging8\.aulos\.es/);
  assert.equal(validateStagingUrl('https://staging8.aulos.es/').hostname, 'staging8.aulos.es');
  assert.throws(() => assertRemoteUnchanged('before', 'after'), /documento remoto cambió/i);
});

test('publisher saves one full-width Elementor HTML document', () => {
  const actions = buildGeoElementorActions('<main class="aulos-geo">prueba</main>');
  const document = actions.save_builder.data;

  assert.equal(document.elements.length, 1);
  assert.equal(document.elements[0].elType, 'container');
  assert.equal(document.elements[0].settings.content_width, 'full');
  assert.equal(document.elements[0].elements.length, 1);
  assert.equal(document.elements[0].elements[0].widgetType, 'html');
  assert.equal(document.elements[0].elements[0].settings.html, '<main class="aulos-geo">prueba</main>');
});

test('fetchRequiredProducts searches every approved title before rendering', async () => {
  const requested = [];
  const found = await fetchRequiredProducts(async (title) => {
    requested.push(title);
    const publicResults = {
      vanguardia: [products[0]],
      luna: [products[1]],
      patrimonio: [products[2]],
      conquista: [{ ...products[3], name: 'La conquista de Portugal' }],
    };
    return publicResults[title];
  });

  assert.deepEqual(requested, ['vanguardia', 'luna', 'patrimonio', 'conquista']);
  assert.deepEqual(found.map((product) => product.name), REQUIRED_PRODUCT_TITLES);
});

test('productSearchTitle uses published catalogue search terms for every featured edition', () => {
  assert.deepEqual(REQUIRED_PRODUCT_TITLES.map(productSearchTitle), ['vanguardia', 'luna', 'patrimonio', 'conquista']);
});
