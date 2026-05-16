import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { RegisterWebSiteDto } from '@scraping/application/dto/register-website.dto';
import { UpdateWebsiteDto } from '@scraping/application/dto/update-website.dto';
import { Website } from '@scraping/domain/entities/website';
import { minifyScrapingScript } from '@scraping/application/utils/script-minifier.util';
import {
	I_WEBSITE_REPOSITORY,
	IWebsiteRepository,
} from '@scraping/application/ports/website-repository.interface';

@Injectable()
export class WebsiteService {
	constructor(
		@Inject(I_WEBSITE_REPOSITORY)
		private readonly websiteRepository: IWebsiteRepository,
	) {}

	async registerWebsite(dto: RegisterWebSiteDto): Promise<Website> {
		this.minifyDtoScripts(dto);
		const website = new Website();
		Object.assign(website, dto);
		return this.websiteRepository.save(website);
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
		return this.websiteRepository.save(website);
	}

	async remove(id: string): Promise<void> {
		await this.websiteRepository.delete(id);
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
	}
}
