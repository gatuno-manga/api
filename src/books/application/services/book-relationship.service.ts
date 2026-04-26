import { Inject, Injectable, Logger } from '@nestjs/common';
import { CreateAuthorDto } from '../dto/create-author.dto';
import { Author } from '../../domain/entities/author';
import { SensitiveContent } from '../../domain/entities/sensitive-content';
import { Tag } from '../../domain/entities/tag';
import {
	I_TAG_REPOSITORY,
	ITagRepository,
} from '../ports/tag-repository.interface';
import {
	I_AUTHOR_REPOSITORY,
	IAuthorRepository,
} from '../ports/author-repository.interface';
import {
	I_SENSITIVE_CONTENT_REPOSITORY,
	ISensitiveContentRepository,
} from '../ports/sensitive-content-repository.interface';

/**
 * Service responsável por gerenciar relacionamentos de livros
 * (Tags, Autores, Conteúdo Sensível)
 */
@Injectable()
export class BookRelationshipService {
	private readonly logger = new Logger(BookRelationshipService.name);

	constructor(
		@Inject(I_TAG_REPOSITORY)
		private readonly tagRepository: ITagRepository,
		@Inject(I_AUTHOR_REPOSITORY)
		private readonly authorRepository: IAuthorRepository,
		@Inject(I_SENSITIVE_CONTENT_REPOSITORY)
		private readonly sensitiveContentRepository: ISensitiveContentRepository,
	) {}

	/**
	 * Busca ou cria tags baseado em nomes.
	 * Carrega todas as tags em uma única query e faz o match em memória,
	 * evitando N queries paralelas com JSON_CONTAINS (full table scan).
	 */
	async findOrCreateTags(
		tagNames: string[],
		repo?: ITagRepository,
	): Promise<Tag[]> {
		if (tagNames.length === 0) return [];
		const tagRepo = repo || this.tagRepository;

		const lowerNames = tagNames.map((n) => n.toLowerCase());

		// Uma única query para carregar todas as tags existentes
		const allTags = await tagRepo.findAll();

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
				try {
					const tag = new Tag();
					tag.name = lowerName;
					const saved = await tagRepo.save(tag);
					this.logger.debug(`Tag criada: ${lowerName}`);
					byName.set(lowerName, saved);
					result.push(saved);
				} catch (err) {
					const tag = await tagRepo.findByName(lowerName);
					if (tag) {
						byName.set(lowerName, tag);
						result.push(tag);
					}
				}
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
		repo?: IAuthorRepository,
	): Promise<Author[]> {
		if (authorsDto.length === 0) return [];
		const authorRepo = repo || this.authorRepository;

		const names = authorsDto.map((a) => a.name);

		// Busca todos os autores do batch de uma vez
		const existing = await authorRepo.findWithFilters({
			sensitiveContent: [],
		}); // Stub

		const byName = new Map<string, Author>(
			existing.map((a) => [a.name, a]),
		);

		const result: Author[] = [];
		for (const dto of authorsDto) {
			const found = byName.get(dto.name);
			if (found) {
				result.push(found);
			} else {
				try {
					const author = new Author();
					author.name = dto.name;
					author.biography = dto.biography ?? null;
					const saved = await authorRepo.save(author);
					this.logger.debug(`Autor criado: ${dto.name}`);
					byName.set(dto.name, saved);
					result.push(saved);
				} catch (err) {
					const author = await authorRepo.findByName(dto.name);
					if (author) {
						byName.set(dto.name, author);
						result.push(author);
					}
				}
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
		repo?: ISensitiveContentRepository,
	): Promise<SensitiveContent[]> {
		if (sensitiveContentNames.length === 0) return [];
		const sensitiveRepo = repo || this.sensitiveContentRepository;

		const lowerNames = sensitiveContentNames.map((n) => n.toLowerCase());

		// Uma única query para carregar todos os conteúdos sensíveis existentes
		const all = await sensitiveRepo.findAll(100);

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
				try {
					const sc = new SensitiveContent();
					sc.name = lowerName;
					const saved = await sensitiveRepo.save(sc);
					this.logger.debug(`Conteúdo sensível criado: ${lowerName}`);
					byName.set(lowerName, saved);
					result.push(saved);
				} catch (err) {
					const sc = await sensitiveRepo.findByName(lowerName);
					if (sc) {
						byName.set(lowerName, sc);
						result.push(sc);
					}
				}
			}
		}
		return result;
	}
}
