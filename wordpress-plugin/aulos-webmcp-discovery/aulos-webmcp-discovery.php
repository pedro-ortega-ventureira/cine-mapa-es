<?php
/**
 * Plugin Name: Aulós WebMCP Discovery
 * Description: Expone el contenido público y el catálogo de Aulós a agentes compatibles con WebMCP.
 * Version: 0.1.2
 * Requires at least: 6.0
 * Requires PHP: 7.4
 * Requires Plugins: woocommerce
 * Text Domain: aulos-webmcp-discovery
 */

defined( 'ABSPATH' ) || exit;

define( 'AULOS_WEBMCP_VERSION', '0.1.2' );
define( 'AULOS_WEBMCP_DIR', plugin_dir_path( __FILE__ ) );
define( 'AULOS_WEBMCP_URL', plugin_dir_url( __FILE__ ) );

function aulos_webmcp_allow_staging_basic_auth( bool $available ): bool {
	if ( ! defined( 'REST_REQUEST' ) || ! REST_REQUEST ) {
		return $available;
	}
	$request_uri = isset( $_SERVER['REQUEST_URI'] ) ? (string) $_SERVER['REQUEST_URI'] : '';
	return false === strpos( $request_uri, '/aulos-webmcp/v1/' ) ? $available : false;
}
add_filter( 'wp_is_application_passwords_available', 'aulos_webmcp_allow_staging_basic_auth' );

function aulos_webmcp_missing_woocommerce_notice(): void {
	if ( current_user_can( 'activate_plugins' ) ) {
		echo '<div class="notice notice-error"><p>' . esc_html__( 'Aulós WebMCP Discovery requiere WooCommerce activo.', 'aulos-webmcp-discovery' ) . '</p></div>';
	}
}

function aulos_webmcp_discovery_bootstrap(): void {
	if ( ! class_exists( 'WooCommerce' ) ) {
		add_action( 'admin_notices', 'aulos_webmcp_missing_woocommerce_notice' );
		return;
	}

	require_once AULOS_WEBMCP_DIR . 'includes/class-aulos-webmcp-presentation.php';
	require_once AULOS_WEBMCP_DIR . 'includes/class-aulos-webmcp-input.php';
	require_once AULOS_WEBMCP_DIR . 'includes/class-aulos-webmcp-content-repository.php';
	require_once AULOS_WEBMCP_DIR . 'includes/class-aulos-webmcp-edition-repository.php';
	require_once AULOS_WEBMCP_DIR . 'includes/class-aulos-webmcp-route-builder.php';
	require_once AULOS_WEBMCP_DIR . 'includes/class-aulos-webmcp-rest-controller.php';
	add_action( 'wp_enqueue_scripts', 'Aulos_WebMCP_Presentation::enqueue_assets' );
	add_action( 'rest_api_init', 'Aulos_WebMCP_REST_Controller::register_routes' );
}
add_action( 'plugins_loaded', 'aulos_webmcp_discovery_bootstrap', 20 );
