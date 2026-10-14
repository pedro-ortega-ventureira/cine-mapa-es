import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const pluginUrl = new URL('../aulos-webmcp-discovery.php', import.meta.url);
const presentationUrl = new URL('../includes/class-aulos-webmcp-presentation.php', import.meta.url);
const assetUrl = new URL('../assets/aulos-webmcp.js', import.meta.url);
const inputUrl = new URL('../includes/class-aulos-webmcp-input.php', import.meta.url);
const contentUrl = new URL('../includes/class-aulos-webmcp-content-repository.php', import.meta.url);
const restUrl = new URL('../includes/class-aulos-webmcp-rest-controller.php', import.meta.url);
const editionUrl = new URL('../includes/class-aulos-webmcp-edition-repository.php', import.meta.url);
const routeBuilderUrl = new URL('../includes/class-aulos-webmcp-route-builder.php', import.meta.url);
const readmeUrl = new URL('../README.md', import.meta.url);
const publisherUrl = new URL('../../../scripts/publish-aulos-webmcp.mjs', import.meta.url);

test('declares the supported WordPress, PHP and WooCommerce boundary', async () => {
  const plugin = await readFile(pluginUrl, 'utf8');

  assert.match(plugin, /Plugin Name:\s*Aulós WebMCP Discovery/);
  assert.match(plugin, /Requires at least:\s*6\.0/);
  assert.match(plugin, /Requires PHP:\s*7\.4/);
  assert.match(plugin, /Requires Plugins:\s*woocommerce/);
  assert.match(plugin, /plugins_loaded/);
  assert.match(plugin, /admin_notices/);
  assert.match(plugin, /wp_is_application_passwords_available/);
  assert.match(plugin, /aulos_webmcp_allow_staging_basic_auth/);
});

test('enqueues one footer asset with public REST configuration', async () => {
  const presentation = await readFile(presentationUrl, 'utf8');

  assert.match(presentation, /class Aulos_WebMCP_Presentation/);
  assert.match(presentation, /function enqueue_assets\(\s*\): void/);
  assert.match(presentation, /wp_enqueue_script/);
  assert.match(presentation, /wp_localize_script/);
  assert.match(presentation, /rest_url/);
  assert.doesNotMatch(presentation, /password|cookie|authorization/i);
});

test('does nothing when the browser has no WebMCP implementation', async () => {
  const source = await readFile(assetUrl, 'utf8');
  let fetched = false;

  vm.runInNewContext(source, {
    document: {},
    fetch: () => {
      fetched = true;
      throw new Error('fetch must not run');
    },
  });

  assert.equal(fetched, false);
});

test('registers exactly three read-only WebMCP discovery tools', async () => {
  const source = await readFile(assetUrl, 'utf8');
  const tools = [];

  vm.runInNewContext(source, {
    document: { modelContext: { registerTool: (tool) => tools.push(tool) } },
    aulosWebMCP: { restRoot: 'https://aulos.test/wp-json/aulos-webmcp/v1/' },
    fetch: async () => ({ ok: true, json: async () => ({ resultados: [] }) }),
    URL,
  });

  assert.deepEqual(
    tools.map(({ name }) => name),
    ['explorar_contenidos', 'buscar_ediciones', 'recomendar_ruta_de_lectura'],
  );
  for (const tool of tools) {
    assert.equal(tool.annotations.readOnlyHint, true);
    assert.equal(tool.annotations.consequentialHint, false);
    assert.equal(tool.inputSchema.type, 'object');
    assert.equal(typeof tool.execute, 'function');
  }
});

test('executes a tool through a same-origin GET request and returns public JSON', async () => {
  const source = await readFile(assetUrl, 'utf8');
  const tools = [];
  const requests = [];
  vm.runInNewContext(source, {
    document: { modelContext: { registerTool: (tool) => tools.push(tool) } },
    aulosWebMCP: { restRoot: 'https://aulos.test/wp-json/aulos-webmcp/v1/' },
    fetch: async (url, options) => {
      requests.push({ url: String(url), options });
      return { ok: true, json: async () => ({ resultados: [{ acceso: 'gratuito' }] }) };
    },
    URL,
  });

  const result = await tools[0].execute({ tema: 'cine', maximo_resultados: 3 }, {});
  assert.match(requests[0].url, /^https:\/\/aulos\.test\/wp-json\/aulos-webmcp\/v1\/content\?/);
  assert.equal(requests[0].options.method, 'GET');
  assert.equal(requests[0].options.credentials, 'same-origin');
  assert.match(result, /"acceso":"gratuito"/);
});

test('bounds and cleans every public query input', async () => {
  const source = await readFile(inputUrl, 'utf8');

  assert.match(source, /function text\(\s*\$value\s*\): string/);
  assert.match(source, /sanitize_text_field/);
  assert.match(source, /mb_substr\([^;]+0,\s*160/);
  assert.match(source, /function limit\(\s*\$value\s*\): int/);
  assert.match(source, /min\(\s*6,\s*max\(\s*1,/);
  assert.match(source, /return 3;/);
});

test('normalizes only public, non-password-protected Zine posts', async () => {
  const source = await readFile(contentUrl, 'utf8');

  assert.match(source, /class Aulos_WebMCP_Content_Repository/);
  assert.match(source, /'post_status'\s*=>\s*'publish'/);
  assert.match(source, /'has_password'\s*=>\s*false/);
  assert.match(source, /'tipo'\s*=>\s*'articulo'/);
  assert.match(source, /'acceso'\s*=>\s*'gratuito'/);
  assert.match(source, /get_permalink/);
  assert.match(source, /280/);
  assert.doesNotMatch(source, /'categoria'\s*=>\s*\$categories\s*\?[^:]+:\s*null/);
});

test('exposes content through a read-only public REST route', async () => {
  const source = await readFile(restUrl, 'utf8');

  assert.match(source, /register_rest_route\(\s*'aulos-webmcp\/v1',\s*'\/content'/);
  assert.match(source, /'methods'\s*=>\s*WP_REST_Server::READABLE/);
  assert.match(source, /'permission_callback'\s*=>\s*'__return_true'/);
  assert.match(source, /function get_content\(\s*WP_REST_Request \$request\s*\): WP_REST_Response/);
  assert.match(source, /rate_limit/);
  assert.match(source, /set_transient/);
});

test('normalizes only published public WooCommerce editions', async () => {
  const source = await readFile(editionUrl, 'utf8');

  assert.match(source, /class Aulos_WebMCP_Edition_Repository/);
  assert.match(source, /wc_get_products/);
  assert.match(source, /'status'\s*=>\s*'publish'/);
  assert.match(source, /'visibility'\s*=>\s*'catalog'/);
  assert.match(source, /'tipo'\s*=>\s*'producto'/);
  assert.match(source, /'acceso'\s*=>\s*'pago'/);
  assert.match(source, /get_permalink/);
  assert.match(source, /get_attribute\(\s*'pa_autor'\s*\)/);
  assert.match(source, /get_attribute\(\s*'pa_formato'\s*\)/);
  assert.doesNotMatch(source, /wc_get_orders|WC_Customer|add_to_cart|checkout|set_/i);
});

test('exposes editions through a read-only public REST route', async () => {
  const source = await readFile(restUrl, 'utf8');

  assert.match(source, /register_rest_route\(\s*'aulos-webmcp\/v1',\s*'\/editions'/);
  assert.match(source, /function get_editions\(\s*WP_REST_Request \$request\s*\): WP_REST_Response/);
});

test('builds factual free-first routes with at most two paid editions', async () => {
  const source = await readFile(routeBuilderUrl, 'utf8');

  assert.match(source, /class Aulos_WebMCP_Route_Builder/);
  assert.match(source, /Aulos_WebMCP_Content_Repository::search/);
  assert.match(source, /Aulos_WebMCP_Edition_Repository::search/);
  assert.match(source, /search\(\s*\$question,\s*'',\s*'',\s*6\s*\)/);
  assert.match(source, /search\(\s*\$interest,\s*'',\s*'',\s*6\s*\)/);
  assert.match(source, /Aulos_WebMCP_Input::tokens/);
  assert.match(source, /array_intersect/);
  assert.match(source, /array_slice\(\s*\$matched_editions,\s*0,\s*2\s*\)/);
  assert.match(source, /array_merge\(\s*\$articles,\s*\$matched_editions\s*\)/);
  assert.match(source, /'motivo'/);
  assert.doesNotMatch(source, /carrito|checkout|coupon|cuenta|order/i);
});

test('exposes the reading route through a read-only public endpoint', async () => {
  const source = await readFile(restUrl, 'utf8');

  assert.match(source, /register_rest_route\(\s*'aulos-webmcp\/v1',\s*'\/reading-route'/);
  assert.match(source, /function get_reading_route\(\s*WP_REST_Request \$request\s*\): WP_REST_Response/);
});

test('ships without secrets or commerce mutations and documents safe rollback', async () => {
  const urls = [pluginUrl, presentationUrl, assetUrl, inputUrl, contentUrl, editionUrl, routeBuilderUrl, restUrl];
  const source = (await Promise.all(urls.map((url) => readFile(url, 'utf8')))).join('\n');
  const readme = await readFile(readmeUrl, 'utf8');

  assert.doesNotMatch(source, /staging8\.aulos\.es|password\s*=|cookie\s*=|authorization\s*:|add_to_cart|checkout/i);
  assert.match(readme, /staging/i);
  assert.match(readme, /desactivar/i);
  assert.match(readme, /WebMCP/i);
});

test('limits paid recommendations without limiting edition search results', async () => {
  const publisher = await readFile(publisherUrl, 'utf8');

  assert.match(publisher, /item\.route === 'reading-route' && item\.paid > 2/);
});

test('recognizes the stable asset handle after optimizer renaming', async () => {
  const publisher = await readFile(publisherUrl, 'utf8');

  assert.match(publisher, /html\.includes\('aulos-webmcp-discovery'\)/);
});

test('replaces only the known staging plugin version', async () => {
  const publisher = await readFile(publisherUrl, 'utf8');

  assert.match(publisher, /mode === '--replace'/);
  assert.match(publisher, /before\.version !== '0\.1\.1'/);
  assert.match(publisher, /await session\.remove\(before\)/);
});

test('verifies public REST access without a WordPress login cookie', async () => {
  const publisher = await readFile(publisherUrl, 'utf8');

  assert.match(publisher, /async publicRequest\(/);
  assert.match(publisher, /this\.publicRequest\(`\$\{base\}\/wp-json\/aulos-webmcp/);
});
