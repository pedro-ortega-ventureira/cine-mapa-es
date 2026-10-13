export const REQUIRED_PRODUCT_TITLES = [
  'La vanguardia prerrafaelista',
  'Leer la Luna. Tarot y cine',
  'Patrimonio Digital',
  'La conquista de Portugal. Historia e iconografía',
];

const PRODUCT_TITLE_ALIASES = new Map([
  ['La vanguardia prerrafaelista', ['vanguardia']],
  ['Leer la Luna. Tarot y cine', ['luna']],
  ['Patrimonio Digital', ['patrimonio']],
  ['La conquista de Portugal. Historia e iconografía', ['La conquista de Portugal']],
]);

const PRODUCT_SEARCH_TERMS = new Map([
  ['La vanguardia prerrafaelista', 'vanguardia'],
  ['Leer la Luna. Tarot y cine', 'luna'],
  ['Patrimonio Digital', 'patrimonio'],
  ['La conquista de Portugal. Historia e iconografía', 'conquista'],
]);

export function productSearchTitle(title) {
  return PRODUCT_SEARCH_TERMS.get(title) ?? title;
}

function normalizeTitle(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function isInternalAulosProduct(product) {
  try {
    const url = new URL(product.permalink);
    return url.protocol === 'https:' && (url.hostname === 'aulos.es' || url.hostname.endsWith('.aulos.es'));
  } catch {
    return false;
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function selectRequiredProducts(products) {
  const available = new Map();
  for (const product of products ?? []) {
    const title = normalizeTitle(product.name);
    if (title && (product.status ?? 'publish') === 'publish' && isInternalAulosProduct(product)) {
      available.set(title.toLocaleLowerCase('es'), product);
    }
  }

  return REQUIRED_PRODUCT_TITLES.map((title) => {
    const product = available.get(title.toLocaleLowerCase('es'))
      ?? (PRODUCT_TITLE_ALIASES.get(title) ?? []).map((alias) => available.get(alias.toLocaleLowerCase('es'))).find(Boolean);
    if (!product) throw new Error(`No se encontró la edición publicada requerida: ${title}.`);
    return { ...product, name: title };
  });
}

export function renderAulosGeoPage(products) {
  const selected = selectRequiredProducts(products);
  const doors = selected.map((product, index) => `
    <article class="aulos-geo__door">
      <span class="aulos-geo__door-number">0${index + 1}</span>
      <h3>${escapeHtml(product.name)}</h3>
      <a href="${escapeHtml(product.permalink)}">Ver edición <span aria-hidden="true">→</span></a>
    </article>`).join('');

  return `<style>
    .aulos-geo{--aulos-paper:#F5F2EC;--aulos-ink:#171717;--aulos-wine:#6D1F2C;--aulos-gold:#B78742;background:var(--aulos-paper);color:var(--aulos-ink);font-family:Manrope,Arial,sans-serif;overflow:hidden}
    .aulos-geo :is(h1,h2,h3){font-family:Georgia,'Times New Roman',serif;font-weight:400;letter-spacing:-.025em}.aulos-geo a{color:inherit}.aulos-geo__hero{background:var(--aulos-ink);color:var(--aulos-paper);padding:clamp(72px,12vw,164px) max(24px,calc((100vw - 1180px)/2));}.aulos-geo__eyebrow{color:#E7C996;font-size:12px;font-weight:700;letter-spacing:.16em;text-transform:uppercase}.aulos-geo h1{font-size:clamp(48px,7vw,88px);line-height:.98;max-width:850px;margin:22px 0}.aulos-geo__intro{font-size:clamp(18px,2.1vw,26px);line-height:1.45;max-width:750px}.aulos-geo__section{padding:clamp(60px,9vw,112px) max(24px,calc((100vw - 1180px)/2));}.aulos-geo__section h2{font-size:clamp(36px,5vw,62px);line-height:1.02;margin:0 0 42px}.aulos-geo__criteria,.aulos-geo__routes,.aulos-geo__doors{display:grid;gap:18px}.aulos-geo__criteria{grid-template-columns:repeat(3,1fr)}.aulos-geo__criterion{border-top:2px solid var(--aulos-wine);padding-top:20px}.aulos-geo__criterion h3,.aulos-geo__door h3{font-size:28px;margin:0 0 14px}.aulos-geo__criterion p{line-height:1.6;margin:0}.aulos-geo__routes{grid-template-columns:repeat(3,1fr)}.aulos-geo__route{background:var(--aulos-wine);color:var(--aulos-paper);min-height:180px;padding:28px;text-decoration:none}.aulos-geo__route span{display:block;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#E7C996;margin-bottom:32px}.aulos-geo__route strong{font-family:Georgia,'Times New Roman',serif;font-size:30px;font-weight:400}.aulos-geo__doors{grid-template-columns:repeat(2,1fr)}.aulos-geo__door{border:1px solid rgba(23,23,23,.2);padding:30px;min-height:220px;display:flex;flex-direction:column}.aulos-geo__door-number{color:var(--aulos-wine);font-size:12px;font-weight:700;letter-spacing:.14em;margin-bottom:auto}.aulos-geo__door a{font-size:14px;font-weight:700;text-decoration-thickness:1px;text-underline-offset:4px}.aulos-geo__closing{background:var(--aulos-gold);padding:clamp(60px,9vw,112px) max(24px,calc((100vw - 1180px)/2));}.aulos-geo__closing h2{font-size:clamp(42px,6vw,76px);max-width:780px;margin:0 0 30px}.aulos-geo__cta{background:var(--aulos-ink);color:var(--aulos-paper);display:inline-block;font-size:14px;font-weight:700;padding:16px 22px;text-decoration:none}.aulos-geo a:focus-visible{outline:3px solid currentColor;outline-offset:4px}@media(max-width:767px){.aulos-geo__criteria,.aulos-geo__routes,.aulos-geo__doors{grid-template-columns:1fr}.aulos-geo__route{min-height:0}}
  </style>
  <main class="aulos-geo">
    <section class="aulos-geo__hero">
      <p class="aulos-geo__eyebrow">Criterio editorial</p>
      <h1>Libros que piden otra forma de leer</h1>
      <p class="aulos-geo__intro">Aulós reúne investigación, arte y pensamiento en ediciones para volver a una pregunta, abrir un archivo y mirar una imagen con más tiempo.</p>
    </section>
    <section class="aulos-geo__section">
      <h2>Un catálogo que se construye por afinidades</h2>
      <div class="aulos-geo__criteria">
        <article class="aulos-geo__criterion"><h3>Materias conectadas</h3><p>Arte, estética, cine y humanidades se encuentran para acompañar una lectura que cruza disciplinas.</p></article>
        <article class="aulos-geo__criterion"><h3>Datos y contexto</h3><p>Cada edición propone una puerta de entrada al tema, con información y diseño al servicio de la lectura.</p></article>
        <article class="aulos-geo__criterion"><h3>Voz propia</h3><p>Las colecciones permiten reconocer recorridos y volver a ellos desde intereses distintos.</p></article>
      </div>
    </section>
    <section class="aulos-geo__section">
      <h2>Cómo elegir un libro Aulós</h2>
      <div class="aulos-geo__routes">
        <a class="aulos-geo__route" href="/catalogo/"><span>Por una pregunta</span><strong>Explora el catálogo completo</strong></a>
        <a class="aulos-geo__route" href="/catalogo/#aulos-humanidades"><span>Por una colección</span><strong>Recorre Humanidades</strong></a>
        <a class="aulos-geo__route" href="/catalogo/#aulos-digital"><span>Por una edición</span><strong>Descubre Aulós Digital</strong></a>
      </div>
    </section>
    <section class="aulos-geo__section">
      <p class="aulos-geo__eyebrow">Selección inicial</p>
      <h2>Cuatro puertas de entrada</h2>
      <div class="aulos-geo__doors">${doors}</div>
    </section>
    <section class="aulos-geo__closing">
      <h2>Un libro puede ser el comienzo de una conversación más larga.</h2>
      <a class="aulos-geo__cta" href="/catalogo/">Entrar en el catálogo <span aria-hidden="true">→</span></a>
    </section>
  </main>`;
}
