<?php

defined( 'ABSPATH' ) || exit;

final class Aulos_WebMCP_Edition_Repository {
	public static function search( string $query, string $collection, string $format, int $limit ): array {
		$args = array(
			'status'     => 'publish',
			'visibility' => 'catalog',
			'limit'      => $limit * 2,
			'return'     => 'objects',
			's'          => $query,
		);
		if ( '' !== $collection ) {
			$args['category'] = array( sanitize_title( $collection ) );
		}

		$items = array();
		foreach ( wc_get_products( $args ) as $product ) {
			$product_format = trim( (string) $product->get_attribute( 'pa_formato' ) );
			if ( '' !== $format && false === mb_stripos( $product_format, $format ) ) {
				continue;
			}
			$url = get_permalink( $product->get_id() );
			if ( ! self::is_internal_https_url( $url ) ) {
				continue;
			}
			$terms      = get_the_terms( $product->get_id(), 'product_cat' );
			$collection_name = is_array( $terms ) && $terms ? $terms[0]->name : '';
			$description = $product->get_short_description() ?: $product->get_description();
			$record = array(
				'tipo'      => 'producto',
				'acceso'    => 'pago',
				'titulo'    => html_entity_decode( $product->get_name(), ENT_QUOTES, 'UTF-8' ),
				'resumen'   => mb_substr( trim( wp_strip_all_tags( $description ) ), 0, 280 ),
				'url_ficha' => esc_url_raw( $url ),
			);

			self::add_when_present( $record, 'coleccion', $collection_name );
			self::add_when_present( $record, 'autor', trim( (string) $product->get_attribute( 'pa_autor' ) ) );
			self::add_when_present( $record, 'formato', $product_format );
			self::add_when_present( $record, 'precio', trim( wp_strip_all_tags( $product->get_price_html() ) ) );
			self::add_when_present( $record, 'disponibilidad', trim( (string) $product->get_stock_status() ) );
			$items[] = $record;
			if ( count( $items ) >= $limit ) {
				break;
			}
		}
		return $items;
	}

	private static function add_when_present( array &$record, string $key, string $value ): void {
		if ( '' !== $value ) {
			$record[ $key ] = $value;
		}
	}

	private static function is_internal_https_url( $url ): bool {
		return is_string( $url )
			&& 'https' === wp_parse_url( $url, PHP_URL_SCHEME )
			&& wp_parse_url( home_url(), PHP_URL_HOST ) === wp_parse_url( $url, PHP_URL_HOST );
	}
}
