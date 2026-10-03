import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

import {
  COLLECTIONS,
  buildHeroModel,
  normalizeCatalogState,
  renderSalesCatalog,
  selectCollectionProducts,
} from './lib/aulos-sales-catalog.mjs';

const AUTHORIZED_HOST = 'staging8.aulos.es';

export function validateStagingUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.hostname !== AUTHORIZED_HOST) {
    throw new Error(`Solo se permite publicar en ${AUTHORIZED_HOST}.`);
  }
  return url;
}

export function redactSecrets(message, secrets = []) {
  return secrets
    .filter(Boolean)
    .reduce((safe, secret) => safe.replaceAll(String(secret), '[REDACTED]'), String(message));
}

export function assertRemoteUnchanged(expectedHash, actualHash) {
  if (expectedHash !== actualHash) {
    throw new Error('El documento remoto cambió después de recuperarlo; se cancela la publicación.');
  }
}

export function buildElementorActions(renderedCatalog, { title = 'Catálogo', status = 'publish' } = {}) {
  return {
    save_builder: {
      action: 'save_builder',
      data: {
        status,
        elements: [
          {
            id: 'a1c47001',
            elType: 'container',
            isInner: false,
            settings: {
              content_width: 'full',
              width: { unit: '%', size: 100, sizes: [] },
              padding: { unit: 'px', top: '0', right: '0', bottom: '0', left: '0', isLinked: true },
            },
            elements: [
              {
                id: 'a1c47002',
                elType: 'widget',
                widgetType: 'html',
                isInner: false,
                settings: { html: renderedCatalog },
                elements: [],
              },
            ],
          },
        ],
        settings: {
          template: 'elementor_canvas',
          post_title: title,
          post_status: status,
          hide_title: 'yes',
        },
      },
    },
  };
}

function normalizeStoreProduct(product) {
  const price = product.price_html || formatStorePrice(product.prices);
  const variations = Array.isArray(product.variations) ? product.variations : [];
  const internalVariation = variations.find((variation) =>
    variation.attributes?.every((attribute) => !/amazon|jot down|gratis/i.test(attribute.value ?? '')),
  );

  return {
    ...product,
    status: 'publish',
    catalog_visibility: 'visible',
    purchasable: Boolean(product.is_purchasable),
    price_html: price,
    date_created: product.date_created || '',
    meta_data: product.meta_data || [],
    internal_variation: internalVariation ?? null,
  };
}

function formatStorePrice(prices = {}) {
  if (!prices.price) return '';
  const divisor = 10 ** Number(prices.currency_minor_unit ?? 2);
  const amount = Number(prices.price) / divisor;
  const formatted = new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: prices.currency_code || 'EUR',
  }).format(amount);
  return `<span class="woocommerce-Price-amount amount">${formatted}</span>`;
}

function prepareHero(product) {
  const hero = buildHeroModel(product);
  const variation = product.internal_variation;
  if (hero.type === 'variable' && variation) {
    const query = new URLSearchParams({
      'add-to-cart': String(hero.id),
      variation_id: String(variation.id),
    });
    for (const attribute of variation.attributes ?? []) {
      query.set(`attribute_${String(attribute.name).toLowerCase()}`, String(attribute.value));
    }
    hero.addToCartUrl = `${new URL(hero.permalink).origin}/?${query}`;
  } else if (hero.type === 'variable') {
    hero.addToCartUrl = null;
  }
  return hero;
}

function parseEnv(text) {
  const result = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator < 1) continue;
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

function parseJsonAssignment(html, variableName) {
  const marker = `var ${variableName} = `;
  const start = html.indexOf(marker);
  if (start < 0) throw new Error(`No se encontró ${variableName}.`);
  let cursor = start + marker.length;
  const jsonStart = cursor;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (; cursor < html.length; cursor += 1) {
    const character = html[cursor];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') inString = false;
    } else if (character === '"') inString = true;
    else if (character === '{') depth += 1;
    else if (character === '}' && --depth === 0) return JSON.parse(html.slice(jsonStart, cursor + 1));
  }
  throw new Error(`No se pudo leer ${variableName}.`);
}

function documentHash(document) {
  return createHash('sha256')
    .update(JSON.stringify({ elements: document.elements, settings: document.settings, status: document.status }))
    .digest('hex');
}

class WordPressSession {
  constructor(config, fetchImpl = fetch) {
    this.config = config;
    this.fetchImpl = fetchImpl;
    this.cookies = new Map();
    this.basicAuth = `Basic ${Buffer.from(`${config.AULOS_BASIC_USER}:${config.AULOS_BASIC_PASSWORD}`).toString('base64')}`;
    this.secrets = [
      config.AULOS_BASIC_PASSWORD,
      config.AULOS_WP_PASSWORD,
      this.basicAuth,
    ];
    this.restNonce = null;
  }

  cookieHeader() {
    return [...this.cookies].map(([name, value]) => `${name}=${value}`).join('; ');
  }

  collectCookies(response) {
    const setCookies = response.headers.getSetCookie?.() ?? [];
    for (const cookie of setCookies) {
      const [pair] = cookie.split(';');
      const separator = pair.indexOf('=');
      if (separator > 0) this.cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
    }
  }

  async request(url, options = {}) {
    const target = validateStagingUrl(url);
    const headers = new Headers(options.headers ?? {});
    headers.set('Authorization', this.basicAuth);
    headers.set('User-Agent', 'Mozilla/5.0 Codex Aulos Staging Publisher');
    if (this.cookies.size) headers.set('Cookie', this.cookieHeader());
    if (this.restNonce && target.pathname.startsWith('/wp-json/')) headers.set('X-WP-Nonce', this.restNonce);
    const response = await this.fetchImpl(target, { ...options, headers, redirect: options.redirect ?? 'manual' });
    this.collectCookies(response);
    return response;
  }

  async login() {
    const base = validateStagingUrl(this.config.AULOS_STAGING_URL).origin;
    await this.request(`${base}/wp-login.php`);
    const body = new URLSearchParams({
      log: this.config.AULOS_WP_USER,
      pwd: this.config.AULOS_WP_PASSWORD,
      'wp-submit': 'Acceder',
      redirect_to: `${base}/wp-admin/plugin-install.php?tab=upload`,
      testcookie: '1',
    });
    await this.request(`${base}/wp-login.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Referer: `${base}/wp-login.php` },
      body,
      redirect: 'manual',
    });
    const admin = await this.request(`${base}/wp-admin/plugin-install.php?tab=upload`);
    if (!admin.ok) throw new Error(`No se pudo abrir el administrador (${admin.status}).`);
    const html = await admin.text();
    const nonceMatch = html.match(/wp\.apiFetch\.createNonceMiddleware\(\s*["']([^"']+)/);
    if (!nonceMatch) throw new Error('No se encontró el nonce REST de WordPress.');
    this.restNonce = nonceMatch[1];
  }

  async fetchCatalog() {
    const base = validateStagingUrl(this.config.AULOS_STAGING_URL).origin;
    const [productsResponse, categoriesResponse] = await Promise.all([
      this.request(`${base}/wp-json/wc/store/v1/products?per_page=100`),
      this.request(`${base}/wp-json/wc/store/v1/products/categories?per_page=100`),
    ]);
    if (!productsResponse.ok || !categoriesResponse.ok) throw new Error('No se pudo recuperar el catálogo público.');
    return {
      products: (await productsResponse.json()).map(normalizeStoreProduct),
      categories: await categoriesResponse.json(),
    };
  }

  async fetchPage() {
    const base = validateStagingUrl(this.config.AULOS_STAGING_URL).origin;
    const response = await this.request(`${base}/wp-json/wp/v2/pages?slug=catalogo&context=edit&per_page=1`);
    if (!response.ok) throw new Error(`No se pudo consultar la página de catálogo (${response.status}).`);
    const pages = await response.json();
    return pages[0] ?? null;
  }

  async createPage() {
    const base = validateStagingUrl(this.config.AULOS_STAGING_URL).origin;
    const response = await this.request(`${base}/wp-json/wp/v2/pages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Catálogo', slug: 'catalogo', status: 'draft', content: '' }),
    });
    if (!response.ok) throw new Error(`No se pudo crear la página de catálogo (${response.status}).`);
    return response.json();
  }

  async fetchCurrentElementorDocument(pageId) {
    const base = validateStagingUrl(this.config.AULOS_STAGING_URL).origin;
    const response = await this.request(`${base}/wp-admin/post.php?post=${Number(pageId)}&action=elementor`);
    if (!response.ok) throw new Error(`No se pudo recuperar Elementor (${response.status}).`);
    const html = await response.text();
    const config = parseJsonAssignment(html, 'ElementorConfig');
    const common = parseJsonAssignment(html, 'elementorCommonConfig');
    const document = config.initial_document;
    return {
      document,
      hash: documentHash(document),
      ajaxUrl: common.ajax.url,
      ajaxNonce: common.ajax.nonce,
    };
  }

  async saveElementor(pageId, expectedHash, renderedCatalog) {
    const current = await this.fetchCurrentElementorDocument(pageId);
    assertRemoteUnchanged(expectedHash, current.hash);
    const body = new URLSearchParams({
      action: 'elementor_ajax',
      editor_post_id: String(pageId),
      initial_document_id: String(pageId),
      _nonce: current.ajaxNonce,
      actions: JSON.stringify(buildElementorActions(renderedCatalog)),
    });
    const response = await this.request(current.ajaxUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
      body,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.success) throw new Error(`Elementor rechazó la actualización (${response.status}).`);
    return payload;
  }

  async verifyRenderedCatalog(url) {
    const response = await this.request(url, { redirect: 'follow' });
    const html = await response.text();
    const headingCount = (html.match(/<h1\b/g) ?? []).length;
    const positions = COLLECTIONS.map((collection) => html.indexOf(collection.name)).filter((position) => position >= 0);
    const ordered = positions.every((position, index) => index === 0 || positions[index - 1] < position);
    return {
      status: response.status,
      hasCatalog: html.includes('aulos-catalog'),
      headingCount,
      ordered,
      hasHero: html.includes('La vanguardia prerrafaelista'),
      hasCartAction: html.includes('add-to-cart=6197'),
    };
  }
}

export async function executePublicationMode(mode, client) {
  const catalog = await client.fetchCatalog();
  const state = normalizeCatalogState(catalog.products, catalog.categories);
  const heroProduct = state.products.find((product) => product.id === 6197);
  if (!heroProduct) throw new Error('No se encontró el producto 6197 en el catálogo publicado.');
  const rawHero = catalog.products.find((product) => Number(product.id) === 6197);
  const hero = prepareHero({ ...heroProduct, internal_variation: rawHero?.internal_variation ?? null });
  const collections = selectCollectionProducts(state, COLLECTIONS, 4);
  const page = await client.fetchPage();
  const manifest = {
    heroId: hero.id,
    collectionCounts: Object.fromEntries(COLLECTIONS.map((item) => [item.name, collections.find((group) => group.slug === item.slug)?.products.length ?? 0])),
    pageId: page?.id ?? null,
    targetSlug: 'catalogo',
    writes: 0,
  };

  if (mode === '--dry-run') return manifest;
  if (mode === '--verify') {
    const base = validateStagingUrl(client.config.AULOS_STAGING_URL).origin;
    return { ...manifest, verification: await client.verifyRenderedCatalog(`${base}/catalogo/`) };
  }
  if (mode !== '--apply') throw new Error('Modo inválido. Usa --dry-run, --apply o --verify.');

  let targetPage = page;
  if (!targetPage) {
    targetPage = await client.createPage();
    manifest.writes += 1;
  }
  const current = await client.fetchCurrentElementorDocument(targetPage.id);
  const rendered = renderSalesCatalog({ hero, collections });
  await client.saveElementor(targetPage.id, current.hash, rendered);
  manifest.pageId = targetPage.id;
  manifest.writes += 1;
  return manifest;
}

async function main() {
  const mode = process.argv[2];
  const config = { ...parseEnv(await readFile('.env.aulos.local', 'utf8')), ...process.env };
  for (const name of ['AULOS_STAGING_URL', 'AULOS_BASIC_USER', 'AULOS_BASIC_PASSWORD', 'AULOS_WP_USER', 'AULOS_WP_PASSWORD']) {
    if (!config[name]) throw new Error(`Falta ${name} en .env.aulos.local.`);
  }
  validateStagingUrl(config.AULOS_STAGING_URL);
  const client = new WordPressSession(config);
  try {
    await client.login();
    const result = await executePublicationMode(mode, client);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(redactSecrets(error?.stack || error?.message || error, client.secrets));
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  await main();
}
