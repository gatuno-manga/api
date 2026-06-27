import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { RegisterWebSiteDto } from '@websites/application/dto/register-website.dto';
import { UpdateWebsiteDto } from '@websites/application/dto/update-website.dto';
import {
	IWebsiteCache,
	I_WEBSITE_CACHE,
} from '@websites/application/ports/website-cache.interface';
import {
	IWebsiteRepository,
	I_WEBSITE_REPOSITORY,
} from '@websites/application/ports/website-repository.interface';
import { minifyScrapingScript } from '@websites/application/utils/script-minifier.util';
import { Website } from '@websites/domain/entities/website';
import { lastValueFrom } from 'rxjs';

@Injectable()
export class WebsiteService {
	constructor(
		@Inject(I_WEBSITE_REPOSITORY)
		private readonly websiteRepository: IWebsiteRepository,
		@Inject(I_WEBSITE_CACHE)
		private readonly websiteCache: IWebsiteCache,
		@Inject('SCRAPER_SERVICE')
		private readonly scraperClient: ClientKafka,
	) {}

	async testScript(
		targetUrl: string,
		script: string,
		context?: 'NEW_BOOK' | 'UPDATE_BOOK' | 'PAGES',
		useFlareSolverr = false,
	): Promise<unknown> {
		const payload = {
			targetUrl,
			script,
			useFlareSolverr,
		};

		const result = await lastValueFrom<Record<string, unknown>>(
			this.scraperClient.send('scraping.test', payload),
		);

		if (context) {
			return this.validateScriptResult(result, context);
		}

		return { isValid: true, result };
	}

	private validateScriptResult(
		result: Record<string, unknown> | unknown[],
		context: 'NEW_BOOK' | 'UPDATE_BOOK' | 'PAGES',
	) {
		const errors: string[] = [];

		if (!result || typeof result !== 'object') {
			return {
				isValid: false,
				errors: ['Script deve retornar um objeto ou array'],
				result,
			};
		}

		if (context === 'NEW_BOOK') {
			const data = result as Record<string, unknown>;
			if (!data.title || typeof data.title !== 'string')
				errors.push('Título (string) é obrigatório');
			if (!Array.isArray(data.chapters))
				errors.push('Lista de capítulos (array) é obrigatória');
			if (!Array.isArray(data.covers))
				errors.push('Lista de capas (array) é obrigatória');
		} else if (context === 'UPDATE_BOOK') {
			const data = result as Record<string, unknown>;
			if (!Array.isArray(data.chapters))
				errors.push('Lista de capítulos (array) é obrigatória');
		} else if (context === 'PAGES') {
			if (!Array.isArray(result))
				errors.push('O script de páginas deve retornar um array');
		}

		return {
			isValid: errors.length === 0,
			errors,
			result,
		};
	}

	async registerWebsite(dto: RegisterWebSiteDto): Promise<Website> {
		this.minifyDtoScripts(dto);
		const website = new Website();
		Object.assign(website, dto);
		const saved = await this.websiteRepository.save(website);
		await this.websiteCache.set(saved);
		return saved;
	}

	async findAll(): Promise<Website[]> {
		return this.websiteRepository.findAll();
	}

	async findOne(id: string): Promise<Website> {
		const website = await this.websiteRepository.findById(id);
		if (!website) {
			throw new NotFoundException(`Website with ID "${id}" not found`);
		}
		return website;
	}

	async getByUrl(url: string): Promise<Website | null> {
		return this.websiteRepository.findByUrl(url);
	}

	async update(id: string, dto: UpdateWebsiteDto): Promise<Website> {
		const website = await this.findOne(id);
		this.minifyDtoScripts(dto);
		Object.assign(website, dto);
		const updated = await this.websiteRepository.save(website);
		await this.websiteCache.set(updated);
		return updated;
	}

	async remove(id: string): Promise<void> {
		await this.websiteRepository.delete(id);
		await this.websiteCache.delete(id);
	}

	/**
	 * Minifica os scripts contidos no DTO antes de persistir
	 */
	private minifyDtoScripts(dto: RegisterWebSiteDto | UpdateWebsiteDto) {
		if (dto.preScript) {
			dto.preScript = minifyScrapingScript(dto.preScript);
		}
		if (dto.posScript) {
			dto.posScript = minifyScrapingScript(dto.posScript);
		}
		if (dto.bookInfoExtractScript) {
			dto.bookInfoExtractScript = minifyScrapingScript(
				dto.bookInfoExtractScript,
			);
		}
		if (dto.newBookExtractScript) {
			dto.newBookExtractScript = minifyScrapingScript(
				dto.newBookExtractScript,
			);
		}
	}
}
