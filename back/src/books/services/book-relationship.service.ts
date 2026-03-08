import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateAuthorDto } from '../dto/create-author.dto';
import { Author } from '../entities/author.entity';
import { SensitiveContent } from '../entities/sensitive-content.entity';
import { Tag } from '../entities/tags.entity';

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
	 * Busca ou cria tags baseado em nomes.
	 * Carrega todas as tags em uma única query e faz o match em memória,
	 * evitando N queries paralelas com JSON_CONTAINS (full table scan).
	 */
	async findOrCreateTags(tagNames: string[]): Promise<Tag[]> {
		if (tagNames.length === 0) return [];

		const lowerNames = tagNames.map((n) => n.toLowerCase());

		// Uma única query para carregar todas as tags existentes
		const allTags = await this.tagRepository.find();

		// Mapas de lookup em memória: name → Tag e altName → Tag
		const byName = new Map<string, Tag>();
		const byAltName = new Map<string, Tag>();
		for (const tag of allTags) {
			byName.set(tag.name.toLowerCase(), tag);
			for (const alt of tag.altNames ?? []) {
				byAltName.set(alt.toLowerCase(), tag);
			}
		}

		const result: Tag[] = [];
		for (const lowerName of lowerNames) {
			const existing = byName.get(lowerName) ?? byAltName.get(lowerName);
			if (existing) {
				result.push(existing);
			} else {
				// Cria sequencialmente para evitar race condition em inserts
				const tag = this.tagRepository.create({ name: lowerName });
				const saved = await this.tagRepository.save(tag);
				this.logger.debug(`Tag criada: ${lowerName}`);
				// Atualiza os mapas para que nomes duplicados no mesmo batch não criem duplicatas
				byName.set(lowerName, saved);
				result.push(saved);
			}
		}
		return result;
	}

	/**
	 * Busca ou cria autores baseado em DTOs.
	 * Usa uma única query para buscar os existentes antes de criar os ausentes.
	 */
	async findOrCreateAuthors(
		authorsDto: CreateAuthorDto[],
	): Promise<Author[]> {
		if (authorsDto.length === 0) return [];

		const names = authorsDto.map((a) => a.name);

		// Busca todos os autores do batch de uma vez
		const existing = await this.authorRepository
			.createQueryBuilder('author')
			.where('author.name IN (:...names)', { names })
			.getMany();

		const byName = new Map<string, Author>(
			existing.map((a) => [a.name, a]),
		);

		const result: Author[] = [];
		for (const dto of authorsDto) {
			const found = byName.get(dto.name);
			if (found) {
				result.push(found);
			} else {
				const author = this.authorRepository.create({
					name: dto.name,
					biography: dto.biography,
				});
				const saved = await this.authorRepository.save(author);
				this.logger.debug(`Autor criado: ${dto.name}`);
				byName.set(dto.name, saved);
				result.push(saved);
			}
		}
		return result;
	}

	/**
	 * Busca ou cria conteúdo sensível baseado em nomes.
	 * Carrega todos em uma única query e faz o match em memória,
	 * evitando N queries paralelas com JSON_CONTAINS (full table scan).
	 */
	async findOrCreateSensitiveContent(
		sensitiveContentNames: string[],
	): Promise<SensitiveContent[]> {
		if (sensitiveContentNames.length === 0) return [];

		const lowerNames = sensitiveContentNames.map((n) => n.toLowerCase());

		// Uma única query para carregar todos os conteúdos sensíveis existentes
		const all = await this.sensitiveContentRepository.find();

		const byName = new Map<string, SensitiveContent>();
		const byAltName = new Map<string, SensitiveContent>();
		for (const sc of all) {
			byName.set(sc.name.toLowerCase(), sc);
			for (const alt of sc.altNames ?? []) {
				byAltName.set(alt.toLowerCase(), sc);
			}
		}

		const result: SensitiveContent[] = [];
		for (const lowerName of lowerNames) {
			const existing = byName.get(lowerName) ?? byAltName.get(lowerName);
			if (existing) {
				result.push(existing);
			} else {
				const sc = this.sensitiveContentRepository.create({
					name: lowerName,
				});
				const saved = await this.sensitiveContentRepository.save(sc);
				this.logger.debug(`Conteúdo sensível criado: ${lowerName}`);
				byName.set(lowerName, saved);
				result.push(saved);
			}
		}
		return result;
	}
}
