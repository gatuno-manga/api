import { normalizeUrl as normalizeUrlUtil } from '@common/utils/url.utils';
import { Transform } from 'class-transformer';

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
	return Transform(({ value }: { value: unknown }) => {
		if (!value) return value;

		// Handle array of URLs
		if (Array.isArray(value)) {
			return value.map((url: unknown) =>
				typeof url === 'string' ? normalizeUrlUtil(url) : url,
			);
		}

		// Handle single URL
		if (typeof value === 'string') {
			return normalizeUrlUtil(value);
		}

		return value;
	});
}
