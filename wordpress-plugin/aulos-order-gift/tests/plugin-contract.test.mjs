import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const pluginPath = new URL('../aulos-order-gift.php', import.meta.url);
const policyPath = new URL('../includes/class-aulos-order-gift-policy.php', import.meta.url);
const servicePath = new URL('../includes/class-aulos-order-gift-service.php', import.meta.url);
const presentationPath = new URL('../includes/class-aulos-order-gift-presentation.php', import.meta.url);

test('defines the Aulós PDF gift product and its WooCommerce policy', async () => {
  const [plugin, policy] = await Promise.all([
    readFile(pluginPath, 'utf8'),
    readFile(policyPath, 'utf8'),
  ]);

  assert.match(plugin, /Plugin Name:\s*Aulós Order Gift/);
  assert.match(plugin, /Requires PHP:\s*7\.4/);
  assert.match(plugin, /Requires Plugins:\s*woocommerce/);
  assert.match(plugin, /class-aulos-order-gift-policy\.php/);
  assert.match(plugin, /AULOS_ORDER_GIFT_PRODUCT_ID[^\n]+13548/);
  assert.match(plugin, /AULOS_ORDER_GIFT_ORDER_META/);
  assert.match(policy, /class Aulos_Order_Gift_Policy/);
  assert.match(policy, /function is_external_item\(\s*WC_Order_Item_Product \$item\s*\): bool/);
  assert.match(policy, /function has_paid_internal_item\(\s*iterable \$items\s*\): bool/);
});

test('makes only internal positive-subtotal items eligible for the gift', async () => {
  const policy = await readFile(policyPath, 'utf8');

  assert.match(policy, /array\(\s*'wpcev_url',\s*'wpcev_text'\s*\)/);
  assert.match(policy, /\$item->get_meta\(\s*\$meta_key,\s*true\s*\)/);
  assert.match(policy, /\$product->get_meta\(\s*\$meta_key,\s*true\s*\)/);
  assert.match(policy, /aulos_order_gift_product_id\(\) === \(int\) \$item->get_product_id\(\)/);
  assert.match(policy, /\(float\) \$item->get_subtotal\(\) > 0/);
});

test('adds one zero-cost PDF gift and grants its download when checkout creates an eligible order', async () => {
  const [plugin, service] = await Promise.all([
    readFile(pluginPath, 'utf8'),
    readFile(servicePath, 'utf8'),
  ]);

  assert.match(plugin, /class-aulos-order-gift-service\.php/);
  assert.match(plugin, /woocommerce_checkout_order_created/);
  assert.match(plugin, /Aulos_Order_Gift_Service::maybe_add_gift/);
  assert.match(service, /function maybe_add_gift\(\s*int \$order_id\s*\): void/);
  assert.match(service, /wc_get_order\(\s*\$order_id\s*\)/);
  assert.match(service, /Aulos_Order_Gift_Policy::has_paid_internal_item/);
  assert.match(service, /new WC_Order_Item_Product/);
  assert.match(service, /aulos_order_gift_product_id\(\)/);
  assert.match(service, /Regalo: Estética y romanticismos \(PDF\)/);
  assert.match(service, /set_subtotal\(\s*0\s*\)/);
  assert.match(service, /set_total\(\s*0\s*\)/);
  assert.match(service, /\$order->save\(\)/);
  assert.match(service, /wc_downloadable_product_permissions\(\s*\$order_id\s*\)/);
});

test('does not duplicate the gift or alter paid items when the creation hook runs again', async () => {
  const service = await readFile(servicePath, 'utf8');

  assert.match(service, /AULOS_ORDER_GIFT_ORDER_META/);
  assert.match(service, /\$order->get_meta\(\s*AULOS_ORDER_GIFT_ORDER_META/);
  assert.match(service, /\$order->get_items\(\)/);
  assert.match(service, /\$item->get_product_id\(\)/);
  assert.match(service, /\$item->get_meta\(\s*'_aulos_order_gift'/);
  assert.match(service, /\$gift_product->is_downloadable\(\)/);
  assert.match(service, /empty\(\s*\$gift_product->get_downloads\(\)\s*\)/);
  assert.doesNotMatch(service, /calculate_totals\s*\(/);
});

test('shows the PDF gift message for internal store purchases in product, cart and checkout', async () => {
  const [plugin, presentation] = await Promise.all([
    readFile(pluginPath, 'utf8'),
    readFile(presentationPath, 'utf8'),
  ]);

  assert.match(plugin, /class-aulos-order-gift-presentation\.php/);
  assert.match(plugin, /Aulos_Order_Gift_Presentation::render_product_notice/);
  assert.match(plugin, /Aulos_Order_Gift_Presentation::render_cart_notice/);
  assert.match(presentation, /function render_product_notice\(\s*\): void/);
  assert.match(presentation, /function render_cart_notice\(\s*\): void/);
  assert.match(presentation, /Con tu compra recibirás de regalo el PDF de Estética y romanticismos\./);
  assert.match(presentation, /role="status"/);
  assert.match(plugin, /woocommerce_before_add_to_cart_button/);
  assert.match(plugin, /woocommerce_before_cart/);
  assert.match(plugin, /woocommerce_before_checkout_form/);
});

test('places a structured gift card in the purchase flow and toggles it for external variations', async () => {
  const [plugin, presentation, stylesheet, script] = await Promise.all([
    readFile(pluginPath, 'utf8'),
    readFile(presentationPath, 'utf8'),
    readFile(new URL('../assets/order-gift.css', import.meta.url), 'utf8'),
    readFile(new URL('../assets/order-gift.js', import.meta.url), 'utf8'),
  ]);

  assert.match(presentation, /assets\/order-gift\.js/);
  assert.match(presentation, /aulos-order-gift-notice__eyebrow/);
  assert.match(presentation, /Un libro digital de regalo/);
  assert.match(presentation, /data-aulos-order-gift/);
  assert.match(presentation, /external_variation_ids/);
  assert.match(presentation, /wpcev_url/);
  assert.match(stylesheet, /\.aulos-order-gift-notice__eyebrow/);
  assert.match(stylesheet, /\.aulos-order-gift-notice\[hidden\]/);
  assert.match(script, /found_variation/);
  assert.match(script, /externalVariationIds/);
  assert.match(script, /notice\.hidden/);
});

test('gives product pages and Botiga quick view the home editorial contrast treatment', async () => {
  const stylesheet = await readFile(new URL('../assets/order-gift.css', import.meta.url), 'utf8');

  assert.match(stylesheet, /\.single-product[^{]*\.product_title[^{]*\{[^}]*color:\s*#171717\s*!important/s);
  assert.match(stylesheet, /\.botiga-quick-view-popup[^{]*\.product_title[^{]*\{[^}]*color:\s*#4f1420\s*!important/s);
  assert.match(stylesheet, /font-family:\s*Georgia,\s*serif/);
  assert.match(stylesheet, /\.single-product[^{]*\.single_add_to_cart_button[^{]*\{[^}]*background:\s*#171717/s);
  assert.match(stylesheet, /\.botiga-quick-view-popup[^{]*\.single_add_to_cart_button[^{]*\{[^}]*background:\s*#171717/s);
  assert.match(stylesheet, /background:\s*#f5f2ec/);
  assert.match(stylesheet, /\.botiga-quick-view-popup \.summary \.price[^{]*\{[^}]*color:\s*#6d1f2c/s);
});

test('uses a clear editorial hierarchy for the price, category and product navigation', async () => {
  const stylesheet = await readFile(new URL('../assets/order-gift.css', import.meta.url), 'utf8');

  assert.match(stylesheet, /\.single-product \.woocommerce-breadcrumb[^{]*\{[^}]*display:\s*none/s);
  assert.match(stylesheet, /\.single-product \.summary \.price[^{]*\{[^}]*color:\s*#4f1420\s*!important/s);
  assert.match(stylesheet, /font-size:\s*clamp\(1\.5rem,\s*3vw,\s*2\.25rem\)/);
  assert.match(stylesheet, /\.single-product \.product_meta \.posted_in[^{]*\{[^}]*color:\s*#6d1f2c\s*!important/s);
  assert.match(stylesheet, /text-transform:\s*uppercase/);
});

test('loads quick-view styles beyond product pages and colors the amount itself', async () => {
  const [presentation, stylesheet] = await Promise.all([
    readFile(presentationPath, 'utf8'),
    readFile(new URL('../assets/order-gift.css', import.meta.url), 'utf8'),
  ]);

  assert.match(presentation, /if \( is_admin\(\) \) \{/);
  assert.doesNotMatch(presentation, /! is_product\(\) && ! is_cart\(\) && ! is_checkout\(\)/);
  assert.match(stylesheet, /\.woocommerce-Price-amount[^{]*\{[^}]*color:\s*#4f1420\s*!important/s);
  assert.match(stylesheet, /\.woocommerce-Price-currencySymbol[^{]*\{[^}]*color:\s*#4f1420\s*!important/s);
});

test('extends the home editorial system across catalogue, cart and checkout', async () => {
  const stylesheet = await readFile(new URL('../assets/order-gift.css', import.meta.url), 'utf8');

  assert.match(stylesheet, /body\.woocommerce-page/);
  assert.match(stylesheet, /--aulos-paper:\s*#f5f2ec/);
  assert.match(stylesheet, /font-family:\s*Inter,\s*Arial,\s*sans-serif/);
  assert.match(stylesheet, /font-family:\s*['\"]?Cormorant Garamond['\"]?,\s*Georgia,\s*serif/);
  assert.match(stylesheet, /\.woocommerce-loop-product__title[^{]*\{[^}]*color:\s*#171717\s*!important/s);
  assert.match(stylesheet, /\.woocommerce-page :is\(h1, h2\)[^{]*\{[^}]*color:\s*#171717\s*!important/s);
  assert.match(stylesheet, /\.woocommerce-page :is\(input, select, textarea\)[^{]*\{[^}]*background:\s*var\(--aulos-raised\)/s);
  assert.match(stylesheet, /\.woocommerce-page :is\(\.button, button, input\[type=['\"]submit['\"]\]\)[^{]*\{[^}]*background:\s*var\(--aulos-ink\)/s);
  assert.match(stylesheet, /@media \(prefers-reduced-motion: reduce\)/);
});

test('overrides Botiga cart quantity and purchase-flow links with the Aulós palette', async () => {
  const stylesheet = await readFile(new URL('../assets/order-gift.css', import.meta.url), 'utf8');

  assert.match(stylesheet, /\.woocommerce-page \.quantity :is\(input\.qty, input\.input-text\)[^{]*\{[^}]*color:\s*var\(--aulos-ink\)\s*!important/s);
  assert.match(stylesheet, /\.woocommerce-page \.quantity :is\(input\.qty, input\.input-text\)[^{]*\{[^}]*background:\s*var\(--aulos-raised\)\s*!important/s);
  assert.match(stylesheet, /\.woocommerce-page :is\(\.woocommerce-cart-form, \.woocommerce-checkout\) a:not\(\.button\)[^{]*\{[^}]*color:\s*var\(--aulos-wine-hover\)\s*!important/s);
});

test('keeps external and free-only purchase paths out of the storefront promotion', async () => {
  const [policy, presentation, stylesheet] = await Promise.all([
    readFile(policyPath, 'utf8'),
    readFile(presentationPath, 'utf8'),
    readFile(new URL('../assets/order-gift.css', import.meta.url), 'utf8'),
  ]);

  assert.match(presentation, /Aulos_Order_Gift_Policy::has_paid_internal_item/);
  assert.match(policy, /is_array\(\s*\$item\s*\)/);
  assert.match(policy, /line_subtotal/);
  assert.match(policy, /wc_get_product\(\s*\$variation_id \?: \$product_id\s*\)/);
  assert.doesNotMatch(presentation, /Amazon|Jot Down/);
  assert.match(presentation, /is_admin\(\)/);
  assert.match(stylesheet, /\.aulos-order-gift-notice/);
  assert.match(stylesheet, /:focus-visible/);
});

test('is release-ready without embedding staging access details', async () => {
  const [plugin, policy, service, presentation] = await Promise.all([
    readFile(pluginPath, 'utf8'),
    readFile(policyPath, 'utf8'),
    readFile(servicePath, 'utf8'),
    readFile(presentationPath, 'utf8'),
  ]);
  const source = [plugin, policy, service, presentation].join('\n');

  assert.match(plugin, /Version:\s*0\.1\.6/);
  assert.match(plugin, /function aulos_order_gift_product_id\(\s*\): int/);
  assert.match(plugin, /apply_filters\(\s*'aulos_order_gift_product_id'/);
  assert.match(policy, /aulos_order_gift_product_id\(\)/);
  assert.match(service, /aulos_order_gift_product_id\(\)/);
  assert.doesNotMatch(source, /staging8\.aulos\.es|https?:\/\/[^\s'"]+|password\s*=|cookie\s*=/i);
});
