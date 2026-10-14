<?php

defined( 'ABSPATH' ) || exit;

final class Aulos_WebMCP_REST_Controller {
	public static function register_routes(): void {
		register_rest_route(
			'aulos-webmcp/v1',
			'/content',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( self::class, 'get_content' ),
				'permission_callback' => '__return_true',
			)
		);
		register_rest_route(
			'aulos-webmcp/v1',
			'/editions',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( self::class, 'get_editions' ),
				'permission_callback' => '__return_true',
			)
		);
		register_rest_route(
			'aulos-webmcp/v1',
			'/reading-route',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( self::class, 'get_reading_route' ),
				'permission_callback' => '__return_true',
			)
		);
	}

	public static function get_content( WP_REST_Request $request ): WP_REST_Response {
		$limited = self::rate_limit();
		if ( $limited ) {
			return $limited;
		}
		$query    = Aulos_WebMCP_Input::text( $request->get_param( 'tema' ) );
		$category = sanitize_title( Aulos_WebMCP_Input::text( $request->get_param( 'categoria' ) ) );
		$limit    = Aulos_WebMCP_Input::limit( $request->get_param( 'maximo_resultados' ) );
		return new WP_REST_Response(
			array( 'resultados' => Aulos_WebMCP_Content_Repository::search( $query, $category, $limit ) ),
			200
		);
	}

	public static function get_editions( WP_REST_Request $request ): WP_REST_Response {
		$limited = self::rate_limit();
		if ( $limited ) {
			return $limited;
		}
		$query      = Aulos_WebMCP_Input::text( $request->get_param( 'consulta' ) );
		$collection = sanitize_title( Aulos_WebMCP_Input::text( $request->get_param( 'coleccion' ) ) );
		$format     = Aulos_WebMCP_Input::text( $request->get_param( 'formato' ) );
		$limit      = Aulos_WebMCP_Input::limit( $request->get_param( 'maximo_resultados' ) );
		return new WP_REST_Response(
			array( 'resultados' => Aulos_WebMCP_Edition_Repository::search( $query, $collection, $format, $limit ) ),
			200
		);
	}

	public static function get_reading_route( WP_REST_Request $request ): WP_REST_Response {
		$limited = self::rate_limit();
		if ( $limited ) {
			return $limited;
		}
		$question = Aulos_WebMCP_Input::text( $request->get_param( 'pregunta' ) );
		$interest = Aulos_WebMCP_Input::text( $request->get_param( 'interes' ) );
		$limit    = Aulos_WebMCP_Input::limit( $request->get_param( 'maximo_resultados' ) );
		return new WP_REST_Response( Aulos_WebMCP_Route_Builder::build( $question, $interest, $limit ), 200 );
	}

	private static function rate_limit(): ?WP_REST_Response {
		$ip = isset( $_SERVER['REMOTE_ADDR'] ) ? sanitize_text_field( wp_unslash( $_SERVER['REMOTE_ADDR'] ) ) : '';
		if ( '' === $ip ) {
			return null;
		}
		$key   = 'aulos_webmcp_rate_' . substr( hash_hmac( 'sha256', $ip, wp_salt( 'nonce' ) ), 0, 32 );
		$count = (int) get_transient( $key );
		if ( $count >= 60 ) {
			return new WP_REST_Response(
				array( 'message' => __( 'Demasiadas consultas. Inténtalo de nuevo en un minuto.', 'aulos-webmcp-discovery' ) ),
				429
			);
		}
		set_transient( $key, $count + 1, MINUTE_IN_SECONDS );
		return null;
	}
}
