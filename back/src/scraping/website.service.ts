import { Injectable } from '@nestjs/common';
import { RegisterWebSiteDto } from './dto/register-website.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Website } from './entitys/website.entity';

@Injectable()
export class WebsiteService {
	constructor(
		@InjectRepository(Website)
		private readonly websiteRepository: Repository<Website>,
	) {}

	async registerWebsite(dto: RegisterWebSiteDto) {
		const website = this.websiteRepository.create(dto);
		return this.websiteRepository.save(website);
	}

	async getByUrl(url: string): Promise<Website | null> {
		const website = await this.websiteRepository.findOne({
			where: { url },
		});
		return website || null;
	}
}
