<?php

defined( 'ABSPATH' ) || exit;

final class Aulos_WebMCP_Content_Repository {
	public static function search( string $query, string $category, int $limit ): array {
		$args = array(
			'post_type'           => 'post',
			'post_status'         => 'publish',
			'has_password'        => false,
			'posts_per_page'      => $limit,
			'ignore_sticky_posts' => true,
			's'                   => $query,
		);
		if ( '' !== $category ) {
			$args['category_name'] = sanitize_title( $category );
		}

		$items = array();
		foreach ( ( new WP_Query( $args ) )->posts as $post ) {
			$url = get_permalink( $post );
			if ( ! self::is_internal_https_url( $url ) ) {
				continue;
			}
			$categories = get_the_category( $post->ID );
			$summary    = get_the_excerpt( $post );
			if ( '' === trim( $summary ) ) {
				$summary = $post->post_content;
			}
			$record = array(
				'tipo'      => 'articulo',
				'acceso'    => 'gratuito',
				'titulo'    => html_entity_decode( get_the_title( $post ), ENT_QUOTES, 'UTF-8' ),
				'resumen'   => mb_substr( trim( wp_strip_all_tags( $summary ) ), 0, 280 ),
				'url'       => esc_url_raw( $url ),
			);
			if ( $categories ) {
				$record['categoria'] = $categories[0]->name;
			}
			$items[] = $record;
		}
		return $items;
	}

	private static function is_internal_https_url( $url ): bool {
		return is_string( $url )
			&& 'https' === wp_parse_url( $url, PHP_URL_SCHEME )
			&& wp_parse_url( home_url(), PHP_URL_HOST ) === wp_parse_url( $url, PHP_URL_HOST );
	}
}
