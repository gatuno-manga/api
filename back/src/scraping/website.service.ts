import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RegisterWebSiteDto } from './dto/register-website.dto';
import { UpdateWebsiteDto } from './dto/update-website.dto';
import { Website } from './entitys/website.entity';

@Injectable()
export class WebsiteService {
	constructor(
		@InjectRepository(Website)
		private readonly websiteRepository: Repository<Website>,
	) {}

	async registerWebsite(dto: RegisterWebSiteDto): Promise<Website> {
		const website = this.websiteRepository.create(dto);
		return this.websiteRepository.save(website);
	}

	async findAll(): Promise<Website[]> {
		return this.websiteRepository.find({
			order: { createdAt: 'DESC' },
		});
	}

	async findOne(id: string): Promise<Website> {
		const website = await this.websiteRepository.findOne({
			where: { id },
		});
		if (!website) {
			throw new NotFoundException(`Website with ID "${id}" not found`);
		}
		return website;
	}

	async getByUrl(url: string): Promise<Website | null> {
		const website = await this.websiteRepository.findOne({
			where: { url },
		});
		return website || null;
	}

	async update(id: string, dto: UpdateWebsiteDto): Promise<Website> {
		const website = await this.findOne(id);
		Object.assign(website, dto);
		return this.websiteRepository.save(website);
	}

	async remove(id: string): Promise<void> {
		const website = await this.findOne(id);
		await this.websiteRepository.remove(website);
	}
}
