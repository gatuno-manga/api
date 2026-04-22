import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { RegisterWebSiteDto } from '../dto/register-website.dto';
import { UpdateWebsiteDto } from '../dto/update-website.dto';
import { Website } from '../../domain/entities/website';
import {
	I_WEBSITE_REPOSITORY,
	IWebsiteRepository,
} from '../ports/website-repository.interface';

@Injectable()
export class WebsiteService {
	constructor(
		@Inject(I_WEBSITE_REPOSITORY)
		private readonly websiteRepository: IWebsiteRepository,
	) {}

	async registerWebsite(dto: RegisterWebSiteDto): Promise<Website> {
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
		Object.assign(website, dto);
		return this.websiteRepository.save(website);
	}

	async remove(id: string): Promise<void> {
		await this.websiteRepository.delete(id);
	}
}
