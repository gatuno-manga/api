import { Logger } from '@nestjs/common';

export interface FlareSolverrCookie {
	name: string;
	value: string;
	domain: string;
	path: string;
	expires: number;
	httpOnly: boolean;
	secure: boolean;
	sameSite?: 'Strict' | 'Lax' | 'None';
}

export interface FlareSolverrResponse {
	status: string;
	message: string;
	solution: {
		url: string;
		status: number;
		cookies: FlareSolverrCookie[];
		userAgent: string;
		response: string;
	};
	startTimestamp: number;
	endTimestamp: number;
	version: string;
}

export class FlareSolverrClient {
	private readonly logger = new Logger(FlareSolverrClient.name);

	constructor(private readonly baseUrl: string) {}

	/**
	 * Resolves a Cloudflare challenge using FlareSolverr.
	 * @param url Target URL
	 * @param proxy Optional proxy URL
	 * @returns Resolved cookies and user agent
	 */
	async resolve(
		url: string,
		proxy?: string,
	): Promise<{ cookies: FlareSolverrCookie[]; userAgent: string } | null> {
		this.logger.debug(
			`Solving challenge for ${url} via ${this.baseUrl}...`,
		);

		try {
			const response = await fetch(`${this.baseUrl}/v1`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					cmd: 'request.get',
					url,
					proxy: proxy ? { url: proxy } : undefined,
					maxTimeout: 60000,
				}),
			});

			if (!response.ok) {
				const errorText = await response.text();
				this.logger.error(
					`FlareSolverr error (HTTP ${response.status}): ${errorText}`,
				);
				return null;
			}

			const data = (await response.json()) as FlareSolverrResponse;

			if (data.status === 'error') {
				this.logger.error(`FlareSolverr failed: ${data.message}`);
				return null;
			}

			this.logger.debug(
				`Successfully resolved challenge. Obtained ${data.solution.cookies.length} cookies.`,
			);

			return {
				cookies: data.solution.cookies,
				userAgent: data.solution.userAgent,
			};
		} catch (error) {
			this.logger.error(
				`Failed to connect to FlareSolverr: ${error.message}`,
			);
			return null;
		}
	}
}
