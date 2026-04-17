import { Transform } from 'class-transformer';
import { normalizeUrl as normalizeUrlUtil } from '../utils/url.utils';

/**
 * Decorator that normalizes URLs by removing 'www.' subdomain
 * Applies to both single URLs and arrays of URLs
 *
 * @example
 * class MyDto {
 *   @NormalizeUrl()
 *   url: string;
 *
 *   @NormalizeUrl()
 *   urls: string[];
 * }
 */
export function NormalizeUrl() {
	return Transform(({ value }) => {
		if (!value) return value;

		// Handle array of URLs
		if (Array.isArray(value)) {
			return value.map((url) => normalizeUrlUtil(url));
		}

		// Handle single URL
		return normalizeUrlUtil(value);
	});
}
