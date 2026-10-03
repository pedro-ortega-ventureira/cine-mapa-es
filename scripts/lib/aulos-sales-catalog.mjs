export const COLLECTIONS = [
  {
    name: 'Aulós Humanidades',
    slug: 'aulos-humanidades',
    description: 'Ensayo, arte y pensamiento para comprender las imágenes, las ideas y sus contextos.',
  },
  {
    name: 'Aulós Digital',
    slug: 'aulos-digital',
    description: 'Investigaciones sobre patrimonio, tecnología y cultura digital desde las humanidades.',
  },
  {
    name: 'Aulós Academics',
    slug: 'aulos-academics',
    description: 'Monografías y estudios especializados nacidos de la investigación académica.',
  },
  {
    name: 'Packs',
    slug: 'packs',
    description: 'Selecciones curatoriales para recorrer una materia, una revista o una línea de pensamiento.',
  },
  {
    name: 'Herejía y Belleza',
    slug: 'herejia-y-belleza',
    description: 'Arte, símbolos y heterodoxias reunidos en una colección de referencia.',
  },
  {
    name: 'Mistérica',
    slug: 'misterica',
    description: 'Estudios y archivos sobre lo sagrado, lo secreto y las tradiciones mistéricas.',
  },
  {
    name: 'Catálogos',
    slug: 'catalogos',
    description: 'Publicaciones de exposiciones y proyectos que conservan y amplían la experiencia de la obra.',
  },
];

const AUTHOR_KEYS = new Set(['autor', 'author', '_product_author', 'product_author']);

function stripTags(value = '') {
  return String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#039;|&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function authorFromProduct(product) {
  const metadata = Array.isArray(product.meta_data) ? product.meta_data : [];
  const entry = metadata.find((item) => AUTHOR_KEYS.has(String(item?.key ?? '').toLowerCase()));
  return stripTags(entry?.value ?? product.author ?? '');
}

function normalizeProduct(product) {
  const images = Array.isArray(product.images) ? product.images : [];
  const categories = Array.isArray(product.categories) ? product.categories : [];
  return {
    id: Number(product.id),
    name: stripTags(product.name),
    slug: String(product.slug ?? ''),
    permalink: String(product.permalink ?? ''),
    status: String(product.status ?? ''),
    visibility: String(product.catalog_visibility ?? 'visible'),
    purchasable: Boolean(product.purchasable),
    type: String(product.type ?? 'simple'),
    externalUrl: String(product.external_url ?? ''),
    priceHtml: String(product.price_html ?? ''),
    description: stripTags(product.short_description ?? ''),
    author: authorFromProduct(product),
    createdAt: Date.parse(product.date_created ?? '') || 0,
    image: images[0]
      ? { src: String(images[0].src ?? ''), alt: stripTags(images[0].alt) || `Portada de ${stripTags(product.name)}` }
      : null,
    categories: categories.map((category) => ({
      id: Number(category.id),
      name: stripTags(category.name),
      slug: String(category.slug ?? ''),
    })),
  };
}

export function normalizeCatalogState(rawProducts = [], rawCategories = []) {
  return {
    products: rawProducts.map(normalizeProduct),
    categories: rawCategories.map((category) => ({
      id: Number(category.id),
      name: stripTags(category.name),
      slug: String(category.slug ?? ''),
      count: Number(category.count ?? 0),
    })),
  };
}

export function selectCollectionProducts(state, orderedCollections = COLLECTIONS, limit = 4) {
  const eligible = state.products.filter(
    (product) => product.status === 'publish' && product.visibility !== 'hidden' && product.permalink,
  );

  return orderedCollections.flatMap((collection) => {
    const products = eligible
      .filter((product) =>
        product.categories.some(
          (category) => category.slug === collection.slug || category.name === collection.name,
        ),
      )
      .sort((left, right) => right.createdAt - left.createdAt)
      .slice(0, limit);

    return products.length ? [{ ...collection, products }] : [];
  });
}

export function buildHeroModel(product) {
  const normalized = product?.priceHtml === undefined ? normalizeProduct(product ?? {}) : product;
  let origin = '';
  try {
    origin = new URL(normalized.permalink).origin;
  } catch {
    origin = '';
  }

  return {
    ...normalized,
    addToCartUrl:
      normalized.purchasable && normalized.type !== 'external' && origin
        ? `${origin}/?add-to-cart=${normalized.id}`
        : null,
  };
}

function renderProductCard(product) {
  const author = product.author
    ? `<p class="aulos-catalog__author">${escapeHtml(product.author)}</p>`
    : '';
  const image = product.image
    ? `<img src="${escapeHtml(product.image.src)}" alt="${escapeHtml(product.image.alt)}" loading="lazy">`
    : '<span class="aulos-catalog__image-placeholder" aria-hidden="true"></span>';

  return `<article class="aulos-catalog__card">
    <a class="aulos-catalog__cover" href="${escapeHtml(product.permalink)}">${image}</a>
    <div class="aulos-catalog__card-copy">
      <h3><a href="${escapeHtml(product.permalink)}">${escapeHtml(product.name)}</a></h3>
      ${author}
      <div class="aulos-catalog__price">${product.priceHtml}</div>
      <a class="aulos-catalog__text-link" href="${escapeHtml(product.permalink)}">Ver edición</a>
    </div>
  </article>`;
}

function renderCollection(collection, { modifier = '', idSuffix = '', headingLevel = 2 } = {}) {
  const headingTag = headingLevel === 3 ? 'h3' : 'h2';
  return `<section class="aulos-catalog__collection ${modifier}" id="${escapeHtml(collection.slug + idSuffix)}">
    <div class="aulos-catalog__section-heading">
      <div><p class="aulos-catalog__eyebrow">Colección</p><${headingTag}>${escapeHtml(collection.name)}</${headingTag}></div>
      <p>${escapeHtml(collection.description)}</p>
    </div>
    <div class="aulos-catalog__grid">${collection.products.map(renderProductCard).join('')}</div>
    <a class="aulos-catalog__collection-link" href="/categoria-producto/${escapeHtml(collection.slug)}/">Ver colección</a>
  </section>`;
}

export function renderSalesCatalog({ hero, collections, allCollections = collections }) {
  const addToCart = hero.addToCartUrl
    ? `<a class="aulos-catalog__button aulos-catalog__button--primary" href="${escapeHtml(hero.addToCartUrl)}" data-product_id="${hero.id}" rel="nofollow">Añadir al carrito</a>`
    : '';
  const heroAuthor = hero.author
    ? `<p class="aulos-catalog__hero-author">${escapeHtml(hero.author)}</p>`
    : '';
  const heroImage = hero.image
    ? `<img src="${escapeHtml(hero.image.src)}" alt="${escapeHtml(hero.image.alt)}">`
    : '';

  return `<style>
.aulos-catalog{--aulos-paper:#F5F2EC;--aulos-raised:#FCFBF8;--aulos-ink:#171717;--aulos-line:#D8D2C8;--aulos-muted:#6F6A62;--aulos-wine:#6D1F2C;--aulos-night:#1D2430;color:var(--aulos-ink);font-family:Inter,Arial,sans-serif;margin:0 calc(50% - 50vw);width:100vw}.aulos-catalog *{box-sizing:border-box}.aulos-catalog a{color:inherit}.aulos-catalog--paper{background:var(--aulos-paper)}.aulos-catalog--paper :is(h1,h2,h3){color:var(--aulos-ink)!important}.aulos-catalog :is(h1,h2,h3){font-family:"Cormorant Garamond",Georgia,serif;font-weight:600;letter-spacing:-.025em}.aulos-catalog__inner{margin:auto;max-width:1280px;padding:clamp(64px,8vw,120px) clamp(16px,5vw,80px)}.aulos-catalog__hero{align-items:center;display:grid;gap:clamp(32px,6vw,88px);grid-template-columns:minmax(0,1.05fr) minmax(280px,.75fr);min-height:680px}.aulos-catalog__hero-copy{max-width:700px}.aulos-catalog__eyebrow{color:var(--aulos-wine)!important;font-size:12px;font-weight:700;letter-spacing:.12em;margin:0 0 18px;text-transform:uppercase}.aulos-catalog h1{font-size:clamp(48px,7vw,94px);line-height:.96;margin:0}.aulos-catalog__hero-author{font-size:14px;font-weight:600;letter-spacing:.04em;margin:20px 0 0}.aulos-catalog__hero-description{color:var(--aulos-muted)!important;font-size:17px;line-height:1.7;margin:30px 0;max-width:58ch}.aulos-catalog__actions{display:flex;flex-wrap:wrap;gap:12px}.aulos-catalog__button{align-items:center;display:inline-flex;font-size:12px;font-weight:700;justify-content:center;letter-spacing:.08em;min-height:44px;padding:12px 20px;text-decoration:none;text-transform:uppercase}.aulos-catalog__button--primary{background:var(--aulos-ink);color:var(--aulos-paper)!important}.aulos-catalog__button--secondary{border:1px solid var(--aulos-ink)}.aulos-catalog__hero-media img{display:block;height:auto;max-height:640px;object-fit:contain;width:100%}.aulos-catalog__nav{background:var(--aulos-night);color:var(--aulos-paper);display:flex;flex-wrap:wrap;gap:8px;justify-content:center;padding:20px clamp(16px,5vw,80px)}.aulos-catalog__nav a{align-items:center;display:inline-flex;font-size:11px;font-weight:700;letter-spacing:.08em;min-height:44px;padding:8px 12px;text-decoration:none;text-transform:uppercase}.aulos-catalog__collection{border-top:1px solid var(--aulos-line);padding:clamp(72px,9vw,132px) 0}.aulos-catalog__section-heading{align-items:end;display:grid;gap:32px;grid-template-columns:minmax(0,1fr) minmax(260px,.7fr);margin-bottom:48px}.aulos-catalog__section-heading h2{font-size:clamp(38px,5vw,64px);line-height:1;margin:0}.aulos-catalog__section-heading>p{color:var(--aulos-muted)!important;line-height:1.7;margin:0}.aulos-catalog__grid{display:grid;gap:clamp(24px,3vw,40px);grid-template-columns:repeat(4,minmax(0,1fr))}.aulos-catalog__cover{background:var(--aulos-raised);display:block;overflow:hidden}.aulos-catalog__cover img,.aulos-catalog__image-placeholder{aspect-ratio:3/4;display:block;height:auto;object-fit:cover;width:100%}.aulos-catalog__card-copy{padding-top:18px}.aulos-catalog__card h3{font-size:clamp(23px,2vw,29px);line-height:1.1;margin:0}.aulos-catalog__card h3 a{text-decoration:none}.aulos-catalog__author{color:var(--aulos-muted)!important;font-size:13px;margin:10px 0}.aulos-catalog__price{color:var(--aulos-wine);font-size:16px;font-weight:700;margin:12px 0}.aulos-catalog__text-link,.aulos-catalog__collection-link{color:var(--aulos-wine)!important;font-size:11px;font-weight:700;letter-spacing:.09em;text-decoration-thickness:1px;text-transform:uppercase;text-underline-offset:4px}.aulos-catalog__collection-link{display:inline-flex;margin-top:36px;min-height:44px}.aulos-catalog :is(a,button):focus-visible{outline:3px solid #1A5DA8;outline-offset:3px}@media(max-width:980px){.aulos-catalog__grid{grid-template-columns:repeat(2,minmax(0,1fr))}.aulos-catalog__hero{min-height:0}}@media(max-width:767px){.aulos-catalog__hero,.aulos-catalog__section-heading{grid-template-columns:1fr}.aulos-catalog__hero-media{grid-row:1}.aulos-catalog__inner{padding-block:64px}.aulos-catalog__nav{justify-content:flex-start;overflow-x:auto}.aulos-catalog__section-heading{margin-bottom:32px}}@media(max-width:479px){.aulos-catalog__grid{grid-template-columns:1fr 1fr;gap:28px 14px}.aulos-catalog__card h3{font-size:21px}.aulos-catalog__card-copy{padding-top:12px}}@media(prefers-reduced-motion:reduce){.aulos-catalog *{scroll-behavior:auto!important;transition:none!important}}
</style>
<main class="aulos-catalog aulos-catalog--paper">
  <section class="aulos-catalog__inner aulos-catalog__hero">
    <div class="aulos-catalog__hero-copy"><p class="aulos-catalog__eyebrow">Edición destacada</p><h1>${escapeHtml(hero.name)}</h1>${heroAuthor}<p class="aulos-catalog__hero-description">${escapeHtml(hero.description)}</p><div class="aulos-catalog__actions"><a class="aulos-catalog__button aulos-catalog__button--secondary" href="${escapeHtml(hero.permalink)}">Ver edición</a>${addToCart}</div></div>
    <div class="aulos-catalog__hero-media">${heroImage}</div>
  </section>
  <nav class="aulos-catalog__nav" aria-label="Colecciones">${collections.map((collection) => `<a href="#${escapeHtml(collection.slug)}">${escapeHtml(collection.name)}</a>`).join('')}</nav>
  <div class="aulos-catalog__inner">
    ${collections.map((collection) => renderCollection(collection)).join('')}
    <section class="aulos-catalog__collection aulos-catalog__all" aria-labelledby="todas-las-ediciones"><div class="aulos-catalog__section-heading"><div><p class="aulos-catalog__eyebrow">Catálogo</p><h2 id="todas-las-ediciones">Todas las ediciones</h2></div><p>Recorre el fondo editorial por líneas de investigación, formatos y afinidades.</p></div>${allCollections.map((collection) => renderCollection(collection, { modifier: 'aulos-catalog__collection--nested', idSuffix: '-todas', headingLevel: 3 })).join('')}</section>
  </div>
</main>`;
}
