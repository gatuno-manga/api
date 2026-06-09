import { AlternativeTitle } from '@books/domain/entities/alternative-title';
import { Author } from '@books/domain/entities/author';
import { Book } from '@books/domain/entities/book';
import { BookDescription } from '@books/domain/entities/book-description';
import { Chapter } from '@books/domain/entities/chapter';
import { Cover } from '@books/domain/entities/cover';
import { SensitiveContent } from '@books/domain/entities/sensitive-content';
import { Tag } from '@books/domain/entities/tag';
import { BookType } from '@books/domain/enums/book-type.enum';
import { ScrapingStatus } from '@books/domain/enums/scrapingStatus.enum';
import { BadRequestException, NotFoundException } from '@nestjs/common';

/**
 * Tipo auxiliar para o builder que substitui os wrappers Relation<T>
 * por tipos diretos, evitando casts desnecessários
 */
type BookBuilderData = Omit<
	Partial<Book>,
	| 'tags'
	| 'authors'
	| 'chapters'
	| 'covers'
	| 'alternativeTitles'
	| 'localizedDescriptions'
> & {
	tags?: Tag[];
	authors?: Author[];
	chapters?: Chapter[];
	covers?: Cover[];
	alternativeTitles?: AlternativeTitle[];
	localizedDescriptions?: BookDescription[];
};

/**
 * Builder Pattern para construção fluente de entidades Book
 * Reduz complexidade e melhora legibilidade na criação de livros
 */
export class BookBuilder {
	private book: BookBuilderData;

	constructor() {
		this.book = {
			type: BookType.BOOK,
			scrapingStatus: ScrapingStatus.READY,
			autoUpdate: false,
			chapters: [],
			tags: [],
			authors: [],
			sensitiveContent: [],
			covers: [],
			alternativeTitles: [],
			localizedDescriptions: [],
			searchTerms: [],
			originalUrl: [],
			originalLanguageCode: null,
		};
	}

	/**
	 * Define o título do livro (obrigatório)
	 */
	withTitle(title: string): this {
		this.book.title = title;
		return this;
	}

	/**
	 * Define títulos alternativos
	 */
	withAlternativeTitles(titles: AlternativeTitle[]): this {
		this.book.alternativeTitles = titles;
		return this;
	}

	/**
	 * Adiciona um título alternativo
	 */
	addAlternativeTitle(title: AlternativeTitle): this {
		if (!this.book.alternativeTitles) {
			this.book.alternativeTitles = [];
		}
		this.book.alternativeTitles.push(title);
		return this;
	}

	/**
	 * Define o código do idioma original (BCP 47)
	 */
	withOriginalLanguageCode(code: string | null): this {
		this.book.originalLanguageCode = code;
		return this;
	}

	/**
	 * Define descrições localizadas
	 */
	withLocalizedDescriptions(descriptions: BookDescription[]): this {
		this.book.localizedDescriptions = descriptions;
		return this;
	}

	/**
	 * Adiciona uma descrição localizada
	 */
	addLocalizedDescription(description: BookDescription): this {
		if (!this.book.localizedDescriptions) {
			this.book.localizedDescriptions = [];
		}
		this.book.localizedDescriptions.push(description);
		return this;
	}

	/**
	 * Define termos de busca (sinônimos)
	 */
	withSearchTerms(terms: string[]): this {
		this.book.searchTerms = terms;
		return this;
	}

	/**
	 * Adiciona um termo de busca (sinônimo)
	 */
	addSearchTerm(term: string): this {
		if (!this.book.searchTerms) {
			this.book.searchTerms = [];
		}
		this.book.searchTerms.push(term);
		return this;
	}

	/**
	 * Define a descrição do livro
	 */
	withDescription(description: string): this {
		this.book.description = description;
		return this;
	}

	/**
	 * Define o tipo do livro
	 */
	withType(type: BookType): this {
		this.book.type = type;
		return this;
	}

	/**
	 * Define o ano de publicação
	 */
	withPublication(year: number): this {
		const currentYear = new Date().getFullYear();
		if (year < 1980 || year > currentYear + 2) {
			throw new Error(
				`Ano de publicação inválido: ${year}. Deve estar entre 1980 e ${currentYear + 2}`,
			);
		}
		this.book.publication = year;
		return this;
	}

	/**
	 * Define se o livro deve ser atualizado automaticamente
	 */
	withAutoUpdate(enabled: boolean): this {
		this.book.autoUpdate = enabled;
		return this;
	}

	/**
	 * Define as URLs originais
	 */
	withOriginalUrls(urls: string[]): this {
		this.book.originalUrl = urls;
		return this;
	}

	/**
	 * Adiciona uma URL original
	 */
	addOriginalUrl(url: string): this {
		if (!this.book.originalUrl) {
			this.book.originalUrl = [];
		}
		this.book.originalUrl.push(url);
		return this;
	}

	/**
	 * Define o status de scraping
	 */
	withScrapingStatus(status: ScrapingStatus): this {
		this.book.scrapingStatus = status;
		return this;
	}

	/**
	 * Define as tags do livro
	 */
	withTags(tags: Tag[]): this {
		this.book.tags = tags;
		return this;
	}

	/**
	 * Adiciona uma tag
	 */
	addTag(tag: Tag): this {
		if (!this.book.tags) {
			this.book.tags = [];
		}
		this.book.tags.push(tag);
		return this;
	}

	/**
	 * Define os autores do livro
	 */
	withAuthors(authors: Author[]): this {
		this.book.authors = authors;
		return this;
	}

	/**
	 * Adiciona um autor
	 */
	addAuthor(author: Author): this {
		if (!this.book.authors) {
			this.book.authors = [];
		}
		this.book.authors.push(author);
		return this;
	}

	/**
	 * Define o conteúdo sensível
	 */
	withSensitiveContent(content: SensitiveContent[]): this {
		this.book.sensitiveContent = content;
		return this;
	}

	/**
	 * Adiciona conteúdo sensível
	 */
	addSensitiveContent(content: SensitiveContent): this {
		if (!this.book.sensitiveContent) {
			this.book.sensitiveContent = [];
		}
		this.book.sensitiveContent.push(content);
		return this;
	}

	/**
	 * Define os capítulos
	 */
	withChapters(chapters: Chapter[]): this {
		this.book.chapters = chapters;
		return this;
	}

	/**
	 * Adiciona um capítulo
	 */
	addChapter(chapter: Chapter): this {
		if (!this.book.chapters) {
			this.book.chapters = [];
		}
		this.book.chapters.push(chapter);
		return this;
	}

	/**
	 * Define as capas
	 */
	withCovers(covers: Cover[]): this {
		this.book.covers = covers;
		return this;
	}

	/**
	 * Adiciona uma capa
	 */
	addCover(cover: Cover): this {
		if (!this.book.covers) {
			this.book.covers = [];
		}
		this.book.covers.push(cover);
		return this;
	}

	/**
	 * Valida os dados obrigatórios
	 */
	private validate(): void {
		if (!this.book.title || this.book.title.trim().length === 0) {
			throw new BadRequestException('Título é obrigatório');
		}

		if (this.book.title.length > 500) {
			throw new BadRequestException(
				'Título não pode ter mais de 500 caracteres',
			);
		}
	}

	/**
	 * Constrói e retorna o objeto Book
	 */
	build(): Book {
		this.validate();
		return this.book as Book;
	}

	/**
	 * Reseta o builder para reutilização
	 */
	reset(): this {
		this.book = {
			type: BookType.BOOK,
			scrapingStatus: ScrapingStatus.READY,
			autoUpdate: false,
			chapters: [],
			tags: [],
			authors: [],
			sensitiveContent: [],
			covers: [],
			alternativeTitles: [],
			localizedDescriptions: [],
			searchTerms: [],
			originalUrl: [],
			originalLanguageCode: null,
		};
		return this;
	}

	/**
	 * Cria um builder a partir de um livro existente (para clonagem/edição)
	 */
	static fromExisting(book: Book): BookBuilder {
		const builder = new BookBuilder();
		builder.book = { ...book } as BookBuilderData;
		return builder;
	}
}
