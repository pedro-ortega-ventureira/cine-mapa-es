<?php

defined( 'ABSPATH' ) || exit;

final class Aulos_WebMCP_Route_Builder {
	public static function build( string $question, string $interest, int $limit ): array {
		$search    = trim( $question . ' ' . $interest );
		$needles   = Aulos_WebMCP_Input::tokens( $search );
		$articles  = Aulos_WebMCP_Content_Repository::search( $search, '', min( 6, $limit ) );
		$editions  = Aulos_WebMCP_Edition_Repository::search( $question, '', '', 6 );
		if ( '' !== $interest ) {
			$editions = array_merge( $editions, Aulos_WebMCP_Edition_Repository::search( $interest, '', '', 6 ) );
		}
		$editions = array_values(
			array_column( array_reverse( $editions ), null, 'url_ficha' )
		);
		$matched_editions = array();

		foreach ( $editions as $edition ) {
			$haystack = implode(
				' ',
				array_filter(
					array(
						$edition['titulo'] ?? '',
						$edition['resumen'] ?? '',
						$edition['coleccion'] ?? '',
						$edition['autor'] ?? '',
						$edition['formato'] ?? '',
					)
				)
			);
			$shared = array_values( array_intersect( $needles, Aulos_WebMCP_Input::tokens( $haystack ) ) );
			if ( ! $shared ) {
				continue;
			}
			$edition['motivo'] = sprintf(
				/* translators: %s is a public matching topic. */
				__( 'Relacionada con el tema «%s».', 'aulos-webmcp-discovery' ),
				$shared[0]
			);
			$matched_editions[] = $edition;
		}

		$matched_editions = array_slice( $matched_editions, 0, 2 );
		$results          = array_merge( $articles, $matched_editions );
		return array(
			'resultados' => $results,
			'mensaje'    => $results ? '' : __( 'No se encontraron contenidos públicos relacionados.', 'aulos-webmcp-discovery' ),
		);
	}
}
