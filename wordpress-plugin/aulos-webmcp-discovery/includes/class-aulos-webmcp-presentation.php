<?php

defined( 'ABSPATH' ) || exit;

final class Aulos_WebMCP_Presentation {
	public static function enqueue_assets(): void {
		if ( is_admin() ) {
			return;
		}

		$handle = 'aulos-webmcp-discovery';
		wp_enqueue_script(
			$handle,
			AULOS_WEBMCP_URL . 'assets/aulos-webmcp.js',
			array(),
			AULOS_WEBMCP_VERSION,
			true
		);
		wp_localize_script(
			$handle,
			'aulosWebMCP',
			array(
				'restRoot' => esc_url_raw( rest_url( 'aulos-webmcp/v1/' ) ),
			)
		);
	}
}
