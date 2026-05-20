export function normalizeUrl(url: string): string {
	if (!url || typeof url !== 'string') return url;

	try {
		const urlObj = new URL(url);
		urlObj.hostname = urlObj.hostname.toLowerCase();

		let normalized = urlObj.toString();

		normalized = normalized.replace(/(:\/\/)(www\.)/gi, '$1');
		normalized = normalized.replace(/\/+$/, '');

		return normalized;
	} catch (_e) {
		let normalized = url.replace(/(:\/\/)(www\.)/gi, '$1');
		normalized = normalized.replace(/\/+$/, '');
		return normalized;
	}
}

export function normalizeUrls(urls: string[]): string[] {
	if (!Array.isArray(urls)) return urls;
	return urls.map(normalizeUrl);
}
