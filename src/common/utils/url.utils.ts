/**
 * Normalizes a URL by removing 'www.' subdomain
 * @param url - The URL to normalize
 * @returns The normalized URL without 'www.'
 */
export function normalizeUrl(url: string): string {
	if (!url || typeof url !== 'string') return url;

	// Remove www. from URLs (e.g., https://www.example.com -> https://example.com)
	return url.replace(/(:\/\/)(www\.)/gi, '$1');
}

/**
 * Normalizes an array of URLs by removing 'www.' subdomain from each
 * @param urls - Array of URLs to normalize
 * @returns Array of normalized URLs without 'www.'
 */
export function normalizeUrls(urls: string[]): string[] {
	if (!Array.isArray(urls)) return urls;
	return urls.map(normalizeUrl);
}
