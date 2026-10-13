import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

import { REQUIRED_PRODUCT_TITLES, productSearchTitle, renderAulosGeoPage, selectRequiredProducts } from './lib/aulos-geo-page.mjs';

const AUTHORIZED_HOST = 'staging8.aulos.es';
const PAGE_SLUG = 'por-que-aulos';
const PAGE_TITLE = 'Por qué elegir Aulós';

export function validateStagingUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.hostname !== AUTHORIZED_HOST) {
    throw new Error(`Solo se permite publicar en ${AUTHORIZED_HOST}.`);
  }
  return url;
}

export function assertRemoteUnchanged(expectedHash, actualHash) {
  if (expectedHash !== actualHash) throw new Error('El documento remoto cambió después de recuperarlo; se cancela la publicación.');
}

export function buildGeoElementorActions(html) {
  return {
    save_builder: {
      action: 'save_builder',
      data: {
        status: 'publish',
        elements: [{
          id: 'a7100001', elType: 'container', isInner: false,
          settings: { content_width: 'full', width: { unit: '%', size: 100, sizes: [] }, padding: { unit: 'px', top: '0', right: '0', bottom: '0', left: '0', isLinked: true } },
          elements: [{ id: 'a7100002', elType: 'widget', widgetType: 'html', isInner: false, settings: { html }, elements: [] }],
        }],
        settings: { template: 'elementor_canvas', post_title: PAGE_TITLE, post_status: 'publish', hide_title: 'yes' },
      },
    },
  };
}

export async function fetchRequiredProducts(searchProducts) {
  const results = await Promise.all(REQUIRED_PRODUCT_TITLES.map((title) => searchProducts(productSearchTitle(title))));
  return selectRequiredProducts(results.flat());
}

function parseEnv(text) {
  return Object.fromEntries(text.split(/\r?\n/).flatMap((line) => {
    const trimmed = line.trim();
    const index = trimmed.indexOf('=');
    if (!trimmed || trimmed.startsWith('#') || index < 1) return [];
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    return [[key, value]];
  }));
}

function parseJsonAssignment(html, variableName) {
  const marker = `var ${variableName} = `;
  const start = html.indexOf(marker);
  if (start < 0) throw new Error(`No se encontró ${variableName}.`);
  let depth = 0; let inString = false; let escaped = false;
  const jsonStart = start + marker.length;
  for (let cursor = jsonStart; cursor < html.length; cursor += 1) {
    const character = html[cursor];
    if (inString) { if (escaped) escaped = false; else if (character === '\\') escaped = true; else if (character === '"') inString = false; }
    else if (character === '"') inString = true;
    else if (character === '{') depth += 1;
    else if (character === '}' && --depth === 0) return JSON.parse(html.slice(jsonStart, cursor + 1));
  }
  throw new Error(`No se pudo leer ${variableName}.`);
}

function documentHash(document) {
  return createHash('sha256').update(JSON.stringify({ elements: document.elements, settings: document.settings, status: document.status })).digest('hex');
}

function redact(message, secrets) {
  return secrets.filter(Boolean).reduce((result, secret) => result.replaceAll(String(secret), '[REDACTED]'), String(message));
}

class StagingSession {
  constructor(config) {
    this.config = config;
    this.cookies = new Map();
    this.basicAuth = `Basic ${Buffer.from(`${config.AULOS_BASIC_USER}:${config.AULOS_BASIC_PASSWORD}`).toString('base64')}`;
    this.secrets = [config.AULOS_BASIC_PASSWORD, config.AULOS_WP_PASSWORD, this.basicAuth];
    this.restNonce = null;
  }

  get base() { return validateStagingUrl(this.config.AULOS_STAGING_URL).origin; }
  cookieHeader() { return [...this.cookies].map(([key, value]) => `${key}=${value}`).join('; '); }
  collectCookies(response) { for (const raw of response.headers.getSetCookie?.() ?? []) { const [pair] = raw.split(';'); const index = pair.indexOf('='); if (index > 0) this.cookies.set(pair.slice(0, index), pair.slice(index + 1)); } }
  async request(url, options = {}) {
    const target = validateStagingUrl(url);
    const headers = new Headers(options.headers ?? {});
    headers.set('Authorization', this.basicAuth); headers.set('User-Agent', 'Mozilla/5.0 Codex Aulos Staging Publisher');
    if (this.cookies.size) headers.set('Cookie', this.cookieHeader());
    if (this.restNonce && target.pathname.startsWith('/wp-json/')) headers.set('X-WP-Nonce', this.restNonce);
    const response = await fetch(target, { ...options, headers, redirect: options.redirect ?? 'manual' });
    this.collectCookies(response); return response;
  }
  async login() {
    await this.request(`${this.base}/wp-login.php`);
    const body = new URLSearchParams({ log: this.config.AULOS_WP_USER, pwd: this.config.AULOS_WP_PASSWORD, 'wp-submit': 'Acceder', redirect_to: `${this.base}/wp-admin/`, testcookie: '1' });
    await this.request(`${this.base}/wp-login.php`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Referer: `${this.base}/wp-login.php` }, body });
    const admin = await this.request(`${this.base}/wp-admin/`);
    if (!admin.ok) throw new Error(`No se pudo abrir el administrador (${admin.status}).`);
    const nonceMatch = (await admin.text()).match(/wp\.apiFetch\.createNonceMiddleware\(\s*["']([^"']+)/);
    if (!nonceMatch) throw new Error('No se encontró el nonce REST de WordPress.');
    this.restNonce = nonceMatch[1];
  }
  async products() {
    return fetchRequiredProducts(async (title) => {
      const response = await this.request(`${this.base}/wp-json/wc/store/v1/products?per_page=100&search=${encodeURIComponent(title)}`);
      if (!response.ok) throw new Error(`No se pudo recuperar el catálogo público (${response.status}).`);
      return response.json();
    });
  }
  async page() {
    const response = await this.request(`${this.base}/wp-json/wp/v2/pages?slug=${PAGE_SLUG}&context=edit&per_page=1`);
    if (!response.ok) throw new Error(`No se pudo consultar la página GEO (${response.status}).`);
    return (await response.json())[0] ?? null;
  }
  async createPage() {
    const response = await this.request(`${this.base}/wp-json/wp/v2/pages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: PAGE_TITLE, slug: PAGE_SLUG, status: 'draft', content: '' }) });
    if (!response.ok) throw new Error(`No se pudo crear la página GEO (${response.status}).`);
    return response.json();
  }
  async document(pageId) {
    const response = await this.request(`${this.base}/wp-admin/post.php?post=${Number(pageId)}&action=elementor`);
    if (!response.ok) throw new Error(`No se pudo recuperar Elementor (${response.status}).`);
    const html = await response.text(); const config = parseJsonAssignment(html, 'ElementorConfig'); const common = parseJsonAssignment(html, 'elementorCommonConfig');
    return { document: config.initial_document, hash: documentHash(config.initial_document), ajaxUrl: common.ajax.url, ajaxNonce: common.ajax.nonce };
  }
  async save(pageId, expectedHash, html) {
    const current = await this.document(pageId); assertRemoteUnchanged(expectedHash, current.hash);
    const body = new URLSearchParams({ action: 'elementor_ajax', editor_post_id: String(pageId), initial_document_id: String(pageId), _nonce: current.ajaxNonce, actions: JSON.stringify(buildGeoElementorActions(html)) });
    const response = await this.request(current.ajaxUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' }, body });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.success) throw new Error(`Elementor rechazó la actualización (${response.status}).`);
  }
  async verify(products) {
    const response = await this.request(`${this.base}/${PAGE_SLUG}/`, { redirect: 'follow' });
    const html = await response.text();
    const links = await Promise.all(products.map(async (product) => ({ url: product.permalink, status: (await this.request(product.permalink, { redirect: 'follow' })).status })));
    return { status: response.status, headingCount: (html.match(/<h1\b/g) ?? []).length, hasPage: html.includes('aulos-geo'), links };
  }
}

export async function executePublicationMode(mode, client) {
  const products = await client.products();
  const page = await client.page();
  if (mode === '--inspect') return { targetSlug: PAGE_SLUG, pageId: page?.id ?? null, products: products.map(({ name, permalink }) => ({ name, permalink })), writes: 0 };
  if (mode === '--verify') return client.verify(products);
  if (mode !== '--apply') throw new Error('Modo inválido. Usa --inspect, --apply o --verify.');
  const target = page ?? await client.createPage();
  const current = await client.document(target.id);
  await client.save(target.id, current.hash, renderAulosGeoPage(products));
  return { targetSlug: PAGE_SLUG, pageId: target.id, writes: page ? 1 : 2 };
}

async function main() {
  const config = { ...parseEnv(await readFile('.env.aulos.local', 'utf8')), ...process.env };
  for (const key of ['AULOS_STAGING_URL', 'AULOS_BASIC_USER', 'AULOS_BASIC_PASSWORD', 'AULOS_WP_USER', 'AULOS_WP_PASSWORD']) if (!config[key]) throw new Error(`Falta ${key} en .env.aulos.local.`);
  const client = new StagingSession(config);
  try { await client.login(); console.log(JSON.stringify(await executePublicationMode(process.argv[2], client), null, 2)); }
  catch (error) { console.error(redact(error?.stack || error?.message || error, client.secrets)); process.exitCode = 1; }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main();
