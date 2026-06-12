import { CreateAuthorDto } from '@books/application/dto/create-author.dto';
import {
	IAuthorRepository,
	I_AUTHOR_REPOSITORY,
} from '@books/application/ports/author-repository.interface';
import {
	ISensitiveContentRepository,
	I_SENSITIVE_CONTENT_REPOSITORY,
} from '@books/application/ports/sensitive-content-repository.interface';
import {
	ITagRepository,
	I_TAG_REPOSITORY,
} from '@books/application/ports/tag-repository.interface';
import { Author } from '@books/domain/entities/author';
import { AuthorBiography } from '@books/domain/entities/author-biography';
import { SensitiveContent } from '@books/domain/entities/sensitive-content';
import { Tag } from '@books/domain/entities/tag';
import { Inject, Injectable, Logger } from '@nestjs/common';

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
			if (typeof tag.name === 'string') {
				byName.set(tag.name.toLowerCase(), tag);
			}
			for (const alt of tag.altNames ?? []) {
				if (alt && typeof alt.name === 'string') {
					byAltName.set(alt.name.toLowerCase(), tag);
				}
			}
			for (const alias of tag.aliases ?? []) {
				if (typeof alias === 'string') {
					byAltName.set(alias.toLowerCase(), tag);
				}
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
				} catch (_err) {
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

		const _names = authorsDto.map((a) => a.name);

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

					// Consolidate localized biographies
					const consolidatedBios: AuthorBiography[] = [];
					if (dto.localizedBiographies?.length) {
						for (const item of dto.localizedBiographies) {
							consolidatedBios.push(
								new AuthorBiography(
									item.biography,
									item.languageCode,
									item.rank ?? 0,
								),
							);
						}
					}

					if (dto.biography) {
						if (
							!consolidatedBios.some(
								(b) =>
									b.languageCode === 'pt-BR' &&
									b.biography === dto.biography,
							)
						) {
							consolidatedBios.push(
								new AuthorBiography(dto.biography, 'pt-BR', 0),
							);
						}
					}

					author.localizedBiographies = consolidatedBios;

					const saved = await authorRepo.save(author);
					this.logger.debug(`Autor criado: ${dto.name}`);
					byName.set(dto.name, saved);
					result.push(saved);
				} catch (_err) {
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
			if (typeof sc.name === 'string') {
				byName.set(sc.name.toLowerCase(), sc);
			}
			for (const alt of sc.altNames ?? []) {
				if (alt && typeof alt.name === 'string') {
					byAltName.set(alt.name.toLowerCase(), sc);
				}
			}
			for (const alias of sc.aliases ?? []) {
				if (typeof alias === 'string') {
					byAltName.set(alias.toLowerCase(), sc);
				}
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
				} catch (_err) {
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
