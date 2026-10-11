import test from 'node:test';
import assert from 'node:assert/strict';

import { planHeadingRepairs, repairRenderedHtml } from './lib/aulos-heading-repair.mjs';
import { assertReplaceablePlugin, classifyPluginInstallation } from './publish-aulos-heading-repair.mjs';

test('planifica solo páginas con H1 de contenido duplicado', () => {
  const audit = [
    { url: 'https://staging8.aulos.es/', mainH1Count: 2, h1Count: 3 },
    { url: 'https://staging8.aulos.es/catalogo/', mainH1Count: 2, h1Count: 2 },
    { url: 'https://staging8.aulos.es/carrito/', mainH1Count: 1, h1Count: 1 },
  ];

  assert.deepEqual(planHeadingRepairs(audit), [
    { path: '/', removeEntryHeader: true, normalizeSiteTitle: true },
    { path: '/catalogo/', removeEntryHeader: true, normalizeSiteTitle: false },
  ]);
});

test('conserva el H1 editorial y elimina solo el título técnico de Botiga', () => {
  const html = `<main><article><header class="entry-header"><h1 class="entry-title page-title">Catálogo</h1></header><div class="entry-content"><h1>Catálogo de Ediciones Aulós</h1></div></article></main>`;

  const result = repairRenderedHtml(html, { removeEntryHeader: true, normalizeSiteTitle: false });

  assert.doesNotMatch(result, /entry-title page-title/);
  assert.match(result, /<h1>Catálogo de Ediciones Aulós<\/h1>/);
  assert.equal((result.match(/<h1\b/g) ?? []).length, 1);
});

test('en la home convierte el nombre del sitio en párrafo sin tocar su enlace', () => {
  const html = `<header><h1 class="site-title"><a href="/">Ediciones Aulós</a></h1></header><main><h1>Investigación que merece perdurar.</h1></main>`;

  const result = repairRenderedHtml(html, { removeEntryHeader: false, normalizeSiteTitle: true });

  assert.match(result, /<p class="site-title"><a href="\/">Ediciones Aulós<\/a><\/p>/);
  assert.equal((result.match(/<h1\b/g) ?? []).length, 1);
});

test('es idempotente y no altera páginas sin reparaciones', () => {
  const html = '<main><h1>Mi cuenta</h1></main>';
  assert.equal(repairRenderedHtml(html, { removeEntryHeader: false, normalizeSiteTitle: false }), html);
  const once = repairRenderedHtml('<h1 class="site-title">Aulós</h1>', { removeEntryHeader: false, normalizeSiteTitle: true });
  assert.equal(repairRenderedHtml(once, { removeEntryHeader: false, normalizeSiteTitle: true }), once);
});

test('considera instalado un plugin que WordPress deja inactivo aunque la página incluya texto genérico de fallo', () => {
  const outcome = classifyPluginInstallation({
    uploadOk: true,
    responseHtml: '<script>const generic = "Installation failed";</script>',
    pluginState: { status: 'inactive' },
  });

  assert.deepEqual(outcome, { installed: true, status: 'inactive' });
});

test('solo permite reemplazar la versión remota esperada del plugin propio', () => {
  assert.doesNotThrow(() => assertReplaceablePlugin({ plugin: 'aulos-heading-repair/aulos-heading-repair', version: '1.0.0', status: 'active' }));
  assert.throws(() => assertReplaceablePlugin({ plugin: 'aulos-heading-repair/aulos-heading-repair', version: '1.0.1', status: 'active' }), /versión remota no coincide/);
  assert.throws(() => assertReplaceablePlugin(null), /no está instalado/);
});
