import { Author } from '../entities/author.entity';
import { Book } from '../entities/book.entity';
import { Chapter } from '../entities/chapter.entity';
import { Cover } from '../entities/cover.entity';
import { SensitiveContent } from '../entities/sensitive-content.entity';
import { Tag } from '../entities/tags.entity';
import { BookType } from '../enum/book-type.enum';
import { ScrapingStatus } from '../enum/scrapingStatus.enum';

/**
 * Tipo auxiliar para o builder que substitui os wrappers Relation<T>
 * por tipos diretos, evitando casts desnecessários
 */
type BookBuilderData = Omit<
	Partial<Book>,
	'tags' | 'authors' | 'chapters' | 'covers'
> & {
	tags?: Tag[];
	authors?: Author[];
	chapters?: Chapter[];
	covers?: Cover[];
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
			alternativeTitle: [],
			originalUrl: [],
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
	withAlternativeTitles(titles: string[]): this {
		this.book.alternativeTitle = titles;
		return this;
	}

	/**
	 * Adiciona um título alternativo
	 */
	addAlternativeTitle(title: string): this {
		if (!this.book.alternativeTitle) {
			this.book.alternativeTitle = [];
		}
		this.book.alternativeTitle.push(title);
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
			throw new Error('Título é obrigatório');
		}

		if (this.book.title.length > 500) {
			throw new Error('Título não pode ter mais de 500 caracteres');
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
			alternativeTitle: [],
			originalUrl: [],
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
