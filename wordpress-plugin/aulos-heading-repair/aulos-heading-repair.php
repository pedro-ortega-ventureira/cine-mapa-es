<?php
/**
 * Plugin Name: Aulós Heading Repair
 * Description: Preserva los encabezados editoriales y elimina duplicados técnicos del tema Botiga.
 * Version: 1.0.1
 * Author: Ediciones Aulós
 * Requires PHP: 7.4
 */

declare(strict_types=1);

if (!defined('ABSPATH')) {
    exit;
}

final class Aulos_Heading_Repair
{
    private const EDITORIAL_PAGES = [
        'home',
        'catalogo',
        'zine',
        'publica-con-aulos',
        'terminos-y-condiciones',
        'politica-de-privacidad',
        'politica-de-cookies-ue',
        'reembolso_devoluciones',
    ];

    public static function init(): void
    {
        add_filter('botiga_entry_header', [self::class, 'show_botiga_entry_header']);
        add_action('template_redirect', [self::class, 'normalize_front_page_site_title']);
    }

    public static function show_botiga_entry_header(bool $show): bool
    {
        return (is_front_page() || is_page(self::EDITORIAL_PAGES)) ? false : $show;
    }

    public static function normalize_front_page_site_title(): void
    {
        if (is_admin() || wp_doing_ajax() || !is_front_page()) {
            return;
        }
        ob_start([self::class, 'replace_front_page_site_title']);
    }

    public static function replace_front_page_site_title(string $html): string
    {
        return (string) preg_replace(
            '/<h1(\s+class=(["\'])[^"\']*\bsite-title\b[^"\']*\2[^>]*)>([\s\S]*?)<\/h1>/i',
            '<p$1>$3</p>',
            $html,
            1
        );
    }
}

Aulos_Heading_Repair::init();
