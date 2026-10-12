<?php
/**
 * Plugin Name: Aulós Production Readiness
 * Description: Redirección canónica del catálogo y cabeceras HTTP de seguridad para Aulós.
 * Version: 1.1.0
 * Author: Ediciones Aulós
 * Requires PHP: 7.4
 */

declare(strict_types=1);

if (!defined('ABSPATH')) {
    exit;
}

final class Aulos_Production_Readiness
{
    private const CSP = "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'self'; form-action 'self' https://www.paypal.com https://*.stripe.com; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://stats.wp.com https://www.googletagmanager.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https://*.gravatar.com https://*.wp.com https://stats.wp.com https://www.google-analytics.com https://www.googletagmanager.com; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' https://*.google-analytics.com https://*.stripe.com https://stats.wp.com https://www.googletagmanager.com; frame-src 'self' https://*.stripe.com https://www.paypal.com https://mistericaland.substack.com; media-src 'self' blob:; worker-src 'self' blob:";

    private const SEO = [
        '/' => ['title' => 'Ediciones Aulós | Libros de arte y humanidades', 'description' => 'Editorial independiente de arte, estética, cine y humanidades. Descubre libros académicos cuidados y publica tu investigación con Aulós.'],
        '/catalogo/' => ['title' => 'Catálogo de libros | Ediciones Aulós', 'description' => 'Descubre el catálogo de Ediciones Aulós: libros de arte, estética, cine, filosofía, ocultura y humanidades editados con rigor y cuidado.'],
        '/zine/' => ['title' => 'Aulós Zine | Arte, cine y pensamiento', 'description' => 'Revista académica de Ediciones Aulós sobre arte, cine, estética, historia, ocultura y humanidades digitales. ISSN 2952-4148.'],
        '/publica-con-aulos/' => ['title' => 'Publica tu investigación | Ediciones Aulós', 'description' => 'Convierte tu tesis, TFM, catálogo o proyecto de investigación en un libro cuidado, riguroso y con recorrido editorial junto a Ediciones Aulós.'],
        '/producto/leer-la-luna-tarot-y-cine-carlos-a-cuellar-alejandro/' => ['title' => 'Leer la Luna: tarot y cine | Ediciones Aulós', 'description' => 'Descubre Leer la Luna, de Carlos A. Cuéllar Alejandro: un ensayo sobre el simbolismo lunar, el tarot y su presencia en la historia del cine.'],
        '/terminos-y-condiciones/' => ['title' => 'Términos y condiciones | Ediciones Aulós', 'description' => 'Consulta las condiciones de acceso, uso y compra de libros y publicaciones en la tienda online de Ediciones Aulós.'],
        '/politica-de-privacidad/' => ['title' => 'Política de privacidad | Ediciones Aulós', 'description' => 'Conoce cómo Ediciones Aulós trata y protege los datos personales de quienes navegan, contactan o compran en su sitio web.'],
        '/politica-de-cookies-ue/' => ['title' => 'Política de cookies | Ediciones Aulós', 'description' => 'Información sobre las cookies utilizadas por Ediciones Aulós, sus finalidades y las opciones disponibles para gestionar el consentimiento.'],
        '/reembolso_devoluciones/' => ['title' => 'Devoluciones y reembolsos | Ediciones Aulós', 'description' => 'Consulta la política de desistimiento, devoluciones y reembolsos aplicable a libros impresos y publicaciones digitales de Ediciones Aulós.'],
    ];

    public static function init(): void
    {
        add_action('template_redirect', [self::class, 'redirect_shop_root'], 1);
        add_action('send_headers', [self::class, 'send_security_headers']);
        add_action('wp_head', [self::class, 'fix_front_page_overflow']);
        add_action('rest_api_init', [self::class, 'register_settings']);
        add_filter('aioseo_title', [self::class, 'seo_title']);
        add_filter('aioseo_description', [self::class, 'seo_description']);
        add_filter('aioseo_robots_meta', [self::class, 'seo_robots']);
    }

    private static function current_path(): string
    {
        $request_uri = isset($_SERVER['REQUEST_URI']) ? wp_unslash((string) $_SERVER['REQUEST_URI']) : '/';
        return (string) wp_parse_url($request_uri, PHP_URL_PATH);
    }

    public static function register_settings(): void
    {
        register_setting('general', 'aulos_csp_mode', [
            'type' => 'string',
            'default' => 'report-only',
            'show_in_rest' => true,
            'sanitize_callback' => static function ($value): string {
                return $value === 'enforce' ? 'enforce' : 'report-only';
            },
        ]);
    }

    public static function seo_title(string $title): string
    {
        $meta = self::SEO[self::current_path()] ?? null;
        return is_array($meta) ? $meta['title'] : $title;
    }

    public static function seo_description(string $description): string
    {
        $meta = self::SEO[self::current_path()] ?? null;
        return is_array($meta) ? $meta['description'] : $description;
    }

    public static function seo_robots(array $attributes): array
    {
        if (in_array(self::current_path(), ['/carrito/', '/mi-cuenta/'], true)) {
            $attributes['noindex'] = 'noindex';
            unset($attributes['nofollow']);
        }
        return $attributes;
    }

    public static function redirect_shop_root(): void
    {
        if (is_admin() || wp_doing_ajax()) {
            return;
        }

        $request_uri = isset($_SERVER['REQUEST_URI']) ? wp_unslash((string) $_SERVER['REQUEST_URI']) : '';
        $path = (string) wp_parse_url($request_uri, PHP_URL_PATH);
        if ($path !== '/shop' && $path !== '/shop/') {
            return;
        }

        $target = home_url('/catalogo/');
        $query = isset($_SERVER['QUERY_STRING']) ? preg_replace('/[\r\n]/', '', wp_unslash((string) $_SERVER['QUERY_STRING'])) : '';
        if ($query !== '') {
            $target .= '?' . $query;
        }

        wp_safe_redirect($target, 301, 'Aulos Production Readiness');
        exit;
    }

    public static function send_security_headers(): void
    {
        if (is_admin()) {
            return;
        }

        header('Referrer-Policy: strict-origin-when-cross-origin', true);
        header('Permissions-Policy: camera=(), microphone=(), geolocation=(), browsing-topics=()', true);
        header('X-Frame-Options: SAMEORIGIN', true);

        $mode = (string) get_option('aulos_csp_mode', 'report-only');
        $name = $mode === 'enforce' ? 'Content-Security-Policy' : 'Content-Security-Policy-Report-Only';
        header($name . ': ' . self::CSP, true);
    }

    public static function fix_front_page_overflow(): void
    {
        if (!is_front_page()) {
            return;
        }
        echo '<style id="aulos-home-overflow-fix">body.home .content-wrapper > .main-row{margin-left:0!important;margin-right:0!important}</style>';
    }
}

Aulos_Production_Readiness::init();
