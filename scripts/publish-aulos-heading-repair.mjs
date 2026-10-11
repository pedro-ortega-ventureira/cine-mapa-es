import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

import { auditPage } from './lib/aulos-production-audit.mjs';

const HOST = 'staging8.aulos.es';
const PLUGIN = 'aulos-heading-repair/aulos-heading-repair';
const PLUGIN_FILE = `${PLUGIN}.php`;
const EXPECTED_V100_HASH = '78670ce21a73283978aa9a1163d3480e2d1e678dc60ea372a763ee51c313d132';
const VERIFY_ROUTES = [
  '/', '/catalogo/', '/zine/', '/publica-con-aulos/', '/terminos-y-condiciones/',
  '/politica-de-privacidad/', '/politica-de-cookies-ue/', '/reembolso_devoluciones/',
];

export function classifyPluginInstallation({ uploadOk, pluginState }) {
  return { installed: Boolean(uploadOk && pluginState), status: pluginState?.status ?? 'absent' };
}

export function assertReplaceablePlugin(pluginState) {
  if (!pluginState) throw new Error('El plugin no está instalado.');
  if (pluginState.plugin !== PLUGIN || pluginState.version !== '1.0.0') {
    throw new Error('La versión remota no coincide con el paquete que se puede reemplazar de forma segura.');
  }
}

function parseEnv(text) {
  return Object.fromEntries(text.split(/\r?\n/).flatMap((line) => {
    const value = line.trim();
    if (!value || value.startsWith('#')) return [];
    const index = value.indexOf('=');
    return index > 0 ? [[value.slice(0, index).trim(), value.slice(index + 1).trim().replace(/^['"]|['"]$/g, '')]] : [];
  }));
}

function stagingUrl(value) {
  const parsed = new URL(value);
  if (parsed.protocol !== 'https:' || parsed.hostname !== HOST) throw new Error(`Solo se permite modificar ${HOST}.`);
  return parsed;
}

function decodeHtml(value) {
  return String(value).replace(/&(#x?[0-9a-f]+|amp|quot|apos|lt|gt);/gi, (match, entity) => {
    const named = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>' };
    if (entity[0] !== '#') return named[entity.toLowerCase()] ?? match;
    const hex = entity[1]?.toLowerCase() === 'x';
    return String.fromCodePoint(Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10));
  });
}

class Session {
  constructor(config) {
    this.config = config;
    this.cookies = new Map();
    this.basic = `Basic ${Buffer.from(`${config.AULOS_BASIC_USER}:${config.AULOS_BASIC_PASSWORD}`).toString('base64')}`;
    this.restNonce = '';
  }
  collect(response) {
    for (const cookie of response.headers.getSetCookie?.() ?? []) {
      const [pair] = cookie.split(';'); const index = pair.indexOf('=');
      if (index > 0) this.cookies.set(pair.slice(0, index), pair.slice(index + 1));
    }
  }
  async request(target, options = {}) {
    const parsed = stagingUrl(target); const headers = new Headers(options.headers ?? {});
    headers.set('Authorization', this.basic); headers.set('User-Agent', 'Codex Aulos Heading Publisher');
    if (this.cookies.size) headers.set('Cookie', [...this.cookies].map(([key, value]) => `${key}=${value}`).join('; '));
    if (this.restNonce && parsed.pathname.startsWith('/wp-json/')) headers.set('X-WP-Nonce', this.restNonce);
    const response = await fetch(parsed, { ...options, headers, redirect: options.redirect ?? 'manual' }); this.collect(response); return response;
  }
  async login() {
    const base = stagingUrl(this.config.AULOS_STAGING_URL).origin;
    await this.request(`${base}/wp-login.php`);
    const body = new URLSearchParams({ log: this.config.AULOS_WP_USER, pwd: this.config.AULOS_WP_PASSWORD, 'wp-submit': 'Acceder', redirect_to: `${base}/wp-admin/plugin-install.php?tab=upload`, testcookie: '1' });
    await this.request(`${base}/wp-login.php`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Referer: `${base}/wp-login.php` }, body });
    const response = await this.request(`${base}/wp-admin/plugin-install.php?tab=upload`);
    if (!response.ok) throw new Error(`No se pudo abrir el instalador (${response.status}).`);
    const html = await response.text(); const nonce = html.match(/wp\.apiFetch\.createNonceMiddleware\(\s*["']([^"']+)/);
    if (!nonce) throw new Error('No se encontró el nonce REST.'); this.restNonce = nonce[1];
  }
  async pluginState() {
    const base = stagingUrl(this.config.AULOS_STAGING_URL).origin;
    const response = await this.request(`${base}/wp-json/wp/v2/plugins/${PLUGIN}?context=edit`);
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`No se pudo consultar el plugin (${response.status}).`);
    return response.json();
  }
  async install(zipPath) {
    const base = stagingUrl(this.config.AULOS_STAGING_URL).origin;
    const page = await this.request(`${base}/wp-admin/plugin-install.php?tab=upload`); const html = await page.text();
    const nonce = html.match(/name=["']_wpnonce["']\s+value=["']([^"']+)/);
    if (!nonce) throw new Error('No se encontró el nonce de subida.');
    const form = new FormData(); form.set('_wpnonce', nonce[1]); form.set('_wp_http_referer', '/wp-admin/plugin-install.php?tab=upload');
    form.set('pluginzip', new Blob([await readFile(zipPath)], { type: 'application/zip' }), 'aulos-heading-repair.zip'); form.set('install-plugin-submit', 'Instalar ahora');
    const upload = await this.request(`${base}/wp-admin/update.php?action=upload-plugin`, { method: 'POST', body: form, redirect: 'follow' });
    await upload.text();
    const outcome = classifyPluginInstallation({ uploadOk: upload.ok, pluginState: await this.pluginState() });
    if (!outcome.installed) throw new Error(`WordPress rechazó la instalación (${upload.status}).`);
  }
  async activate() {
    const base = stagingUrl(this.config.AULOS_STAGING_URL).origin;
    const response = await this.request(`${base}/wp-json/wp/v2/plugins/${PLUGIN}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'active' }),
    });
    if (!response.ok) throw new Error(`No se pudo activar el plugin (${response.status}).`);
  }
  async removePlugin(pluginState) {
    const base = stagingUrl(this.config.AULOS_STAGING_URL).origin;
    if (pluginState.status === 'active') {
      const deactivate = await this.request(`${base}/wp-json/wp/v2/plugins/${PLUGIN}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'inactive' }),
      });
      if (!deactivate.ok) throw new Error(`No se pudo desactivar el plugin (${deactivate.status}).`);
    }
    const remove = await this.request(`${base}/wp-json/wp/v2/plugins/${PLUGIN}`, { method: 'DELETE' });
    if (!remove.ok) throw new Error(`No se pudo retirar la versión anterior del plugin (${remove.status}).`);
  }
  async updateSource(sourcePath) {
    const base = stagingUrl(this.config.AULOS_STAGING_URL).origin;
    const editorUrl = `${base}/wp-admin/plugin-editor.php?file=${encodeURIComponent(PLUGIN_FILE)}&plugin=${encodeURIComponent(PLUGIN_FILE)}`;
    const editor = await this.request(editorUrl); const html = await editor.text();
    if (!editor.ok) throw new Error(`No se pudo abrir el editor del plugin (${editor.status}).`);
    const nonce = html.match(/name=["']_wpnonce["']\s+value=["']([^"']+)/);
    const content = html.match(/<textarea\b[^>]*id=["']newcontent["'][^>]*>([\s\S]*?)<\/textarea>/i);
    if (!nonce || !content) throw new Error('No se pudo recuperar la versión vigente del plugin.');
    const current = decodeHtml(content[1]);
    const currentHash = createHash('sha256').update(current).digest('hex');
    if (currentHash !== EXPECTED_V100_HASH) throw new Error('El plugin remoto cambió; se cancela la actualización.');
    const body = new URLSearchParams({
      _wpnonce: nonce[1], _wp_http_referer: `/wp-admin/plugin-editor.php?file=${encodeURIComponent(PLUGIN_FILE)}&plugin=${encodeURIComponent(PLUGIN_FILE)}`,
      newcontent: await readFile(sourcePath, 'utf8'), action: 'update', file: PLUGIN_FILE, plugin: PLUGIN_FILE, scrollto: '0', 'docs-list': '',
    });
    const response = await this.request(`${base}/wp-admin/plugin-editor.php`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' }, body, redirect: 'follow',
    });
    const result = await response.text();
    if (!response.ok || /Unable to communicate back|fatal error|No ha sido posible/i.test(result)) throw new Error(`WordPress rechazó la actualización del plugin (${response.status}).`);
  }
  async verify() {
    const base = stagingUrl(this.config.AULOS_STAGING_URL).origin; const pages = [];
    for (const route of VERIFY_ROUTES) {
      const target = new URL(route, base); target.searchParams.set('heading_verify', Date.now().toString());
      const response = await this.request(target, { headers: { 'Cache-Control': 'no-cache' }, redirect: 'follow' });
      const page = auditPage(await response.text(), response.headers, new URL(route, base), response.status);
      pages.push({ path: route, status: page.status, h1Count: page.h1Count, mainH1Count: page.mainH1Count });
    }
    return pages;
  }
}

async function main() {
  const mode = process.argv[2]; const zipPath = process.argv[3];
  if (!['--inspect', '--apply', '--update', '--replace', '--verify'].includes(mode)) throw new Error('Usa --inspect, --apply, --update, --replace o --verify.');
  const config = { ...parseEnv(await readFile('.env.aulos.local', 'utf8')), ...process.env };
  for (const key of ['AULOS_STAGING_URL', 'AULOS_BASIC_USER', 'AULOS_BASIC_PASSWORD', 'AULOS_WP_USER', 'AULOS_WP_PASSWORD']) if (!config[key]) throw new Error(`Falta ${key}.`);
  const client = new Session(config); await client.login();
  if (mode === '--verify') { console.log(JSON.stringify(await client.verify(), null, 2)); return; }
  const before = await client.pluginState();
  if (mode === '--inspect') { console.log(JSON.stringify({ installed: Boolean(before), status: before?.status ?? 'absent' }, null, 2)); return; }
  if (mode === '--update') {
    if (!before) throw new Error('El plugin no está instalado.');
    if (!zipPath) throw new Error('Indica el archivo PHP actualizado.');
    await client.updateSource(zipPath);
    const verification = await client.verify();
    if (verification.some((page) => page.status !== 200 || page.h1Count !== 1 || page.mainH1Count !== 1)) throw new Error('La verificación semántica posterior no coincide con lo esperado.');
    console.log(JSON.stringify({ updated: true, verification }, null, 2)); return;
  }
  if (mode === '--replace') {
    assertReplaceablePlugin(before);
    if (!zipPath) throw new Error('Indica el ZIP actualizado.');
    await client.removePlugin(before);
    await client.install(zipPath);
    await client.activate();
    const after = await client.pluginState(); const verification = await client.verify();
    if (after?.status !== 'active' || after?.version !== '1.0.1' || verification.some((page) => page.status !== 200 || page.h1Count !== 1 || page.mainH1Count !== 1)) throw new Error('La verificación semántica posterior no coincide con lo esperado.');
    console.log(JSON.stringify({ replaced: true, status: after.status, version: after.version, verification }, null, 2)); return;
  }
  if (!before) {
    if (!zipPath) throw new Error('Indica la ruta del ZIP para instalar el plugin.');
    await client.install(zipPath);
  }
  const installed = await client.pluginState();
  if (installed?.status !== 'active') await client.activate();
  const after = await client.pluginState(); const verification = await client.verify();
  if (after?.status !== 'active' || verification.some((page) => page.status !== 200 || page.h1Count !== 1 || page.mainH1Count !== 1)) throw new Error('La verificación semántica posterior no coincide con lo esperado.');
  console.log(JSON.stringify({ installed: true, status: after.status, verification }, null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main().catch((error) => { console.error(error?.message ?? String(error)); process.exitCode = 1; });
