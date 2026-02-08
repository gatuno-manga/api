import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateAuthorDto } from '../dto/create-author.dto';
import { Author } from '../entitys/author.entity';
import { SensitiveContent } from '../entitys/sensitive-content.entity';
import { Tag } from '../entitys/tags.entity';

/**
 * Service responsável por gerenciar relacionamentos de livros
 * (Tags, Autores, Conteúdo Sensível)
 */
@Injectable()
export class BookRelationshipService {
	private readonly logger = new Logger(BookRelationshipService.name);

	constructor(
		@InjectRepository(Tag)
		private readonly tagRepository: Repository<Tag>,
		@InjectRepository(Author)
		private readonly authorRepository: Repository<Author>,
		@InjectRepository(SensitiveContent)
		private readonly sensitiveContentRepository: Repository<SensitiveContent>,
	) {}

	/**
	 * Busca ou cria tags baseado em nomes
	 */
	async findOrCreateTags(tagNames: string[]): Promise<Tag[]> {
		return Promise.all(
			tagNames.map(async (tagName) => {
				const lowerTagName = tagName.toLowerCase();
				let tag = await this.tagRepository
					.createQueryBuilder('tag')
					.where('tag.name = :tagName', { tagName: lowerTagName })
					.orWhere('JSON_CONTAINS(tag.altNames, :jsonTagName)', {
						jsonTagName: `"${lowerTagName}"`,
					})
					.getOne();
				if (!tag) {
					tag = this.tagRepository.create({ name: lowerTagName });
					await this.tagRepository.save(tag);
					this.logger.debug(`Tag criada: ${lowerTagName}`);
				}
				return tag;
			}),
		);
	}

	/**
	 * Busca ou cria autores baseado em DTOs
	 */
	async findOrCreateAuthors(
		authorsDto: CreateAuthorDto[],
	): Promise<Author[]> {
		return Promise.all(
			authorsDto.map(async (authorDto) => {
				let author = await this.authorRepository.findOne({
					where: { name: authorDto.name },
				});
				if (!author) {
					author = this.authorRepository.create({
						name: authorDto.name,
						biography: authorDto.biography,
					});
					await this.authorRepository.save(author);
					this.logger.debug(`Autor criado: ${authorDto.name}`);
				}
				return author;
			}),
		);
	}

	/**
	 * Busca ou cria conteúdo sensível baseado em nomes
	 */
	async findOrCreateSensitiveContent(
		sensitiveContentNames: string[],
	): Promise<SensitiveContent[]> {
		return Promise.all(
			sensitiveContentNames.map(async (name) => {
				const lowerName = name.toLowerCase();
				let sensitiveContent = await this.sensitiveContentRepository
					.createQueryBuilder('sensitiveContent')
					.where('sensitiveContent.name = :name', { name: lowerName })
					.orWhere(
						'JSON_CONTAINS(sensitiveContent.altNames, :jsonName)',
						{
							jsonName: `"${lowerName}"`,
						},
					)
					.getOne();
				if (!sensitiveContent) {
					sensitiveContent = this.sensitiveContentRepository.create({
						name: lowerName,
					});
					await this.sensitiveContentRepository.save(
						sensitiveContent,
					);
					this.logger.debug(`Conteúdo sensível criado: ${lowerName}`);
				}
				return sensitiveContent;
			}),
		);
	}
}
