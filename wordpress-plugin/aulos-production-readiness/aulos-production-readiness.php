<?php
/**
 * Plugin Name: Aulós Production Readiness
 * Description: Redirección canónica del catálogo y cabeceras HTTP de seguridad para Aulós.
 * Version: 1.0.2
 * Author: Ediciones Aulós
 * Requires PHP: 7.4
 */

declare(strict_types=1);

if (!defined('ABSPATH')) {
    exit;
}

final class Aulos_Production_Readiness
{
    private const CSP = "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'self'; form-action 'self' https://www.paypal.com https://*.stripe.com; script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: blob: https:; font-src 'self' data: https:; connect-src 'self' https:; frame-src 'self' https:; media-src 'self' blob: https:; worker-src 'self' blob:";

    public static function init(): void
    {
        add_action('template_redirect', [self::class, 'redirect_shop_root'], 1);
        add_action('send_headers', [self::class, 'send_security_headers']);
        add_action('wp_head', [self::class, 'fix_front_page_overflow']);
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

        $mode = (string) apply_filters('aulos_csp_mode', 'enforce');
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
