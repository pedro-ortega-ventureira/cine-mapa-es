<?php

defined( 'ABSPATH' ) || exit;

final class Aulos_WebMCP_Input {
	public static function text( $value ): string {
		$value = sanitize_text_field( is_scalar( $value ) ? (string) $value : '' );
		return trim( mb_substr( $value, 0, 160 ) );
	}

	public static function limit( $value ): int {
		if ( null === $value || '' === $value ) {
			return 3;
		}
		return min( 6, max( 1, absint( $value ) ) );
	}

	public static function tokens( string $text ): array {
		$text   = remove_accents( mb_strtolower( self::text( $text ) ) );
		$tokens = preg_split( '/[^a-z0-9]+/u', $text, -1, PREG_SPLIT_NO_EMPTY );
		$stop   = array( 'de', 'del', 'la', 'las', 'el', 'los', 'y', 'o', 'en', 'un', 'una', 'para', 'por', 'con', 'que' );
		return array_values( array_unique( array_diff( $tokens ?: array(), $stop ) ) );
	}
}
