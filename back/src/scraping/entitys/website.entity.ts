import {
	Column,
	CreateDateColumn,
	Entity,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from 'typeorm';

@Entity('websites')
export class Website {
	@PrimaryGeneratedColumn('uuid')
	id: string;

	@Column()
	url: string;

	@Column({
		type: 'text',
		nullable: true,
	})
	preScript: string;

	@Column({
		type: 'text',
		nullable: true,
	})
	posScript: string;

	@Column({
		type: 'text',
	})
	selector: string;

	/**
	 * Seletor CSS para a lista de capítulos na página do livro.
	 * Ex: '.chapter-list a', '#chapters li a'
	 */
	@Column({
		type: 'text',
		nullable: true,
	})
	chapterListSelector: string;

	/**
	 * Script unificado para extrair todas as informações do livro.
	 * Deve retornar um objeto com:
	 * - cover: string (URL da capa)
	 * - chapters: array de {title, url, index, isFinal?}
	 */
	@Column({
		type: 'text',
		nullable: true,
	})
	bookInfoExtractScript: string;

	@Column({
		type: 'int',
		nullable: true,
	})
	concurrencyLimit: number | null;

	/**
	 * Lista negra: URLs contendo estes termos serão ignoradas.
	 * Ex: ['logo', 'icon', 'avatar', 'ads', 'banner']
	 */
	@Column({
		type: 'json',
		nullable: true,
	})
	blacklistTerms: string[];

	/**
	 * Lista branca: Se preenchida, apenas URLs contendo estes termos serão aceitas.
	 * Ex: ['cdn.site.com', 'uploads/chapters']
	 */
	@Column({
		type: 'json',
		nullable: true,
	})
	whitelistTerms: string[];

	/**
	 * Habilitar interceptação de tráfego de rede para cache de imagens.
	 * Mais eficiente que fazer fetch separado.
	 */
	@Column({
		type: 'boolean',
		default: true,
	})
	useNetworkInterception: boolean;

	@Column({
		type: 'boolean',
		default: false,
	})
	useScreenshotMode: boolean;

	/**
	 * Cookies a serem injetados antes da navegação.
	 * Útil para configurações de idioma, bypass de consentimento, etc.
	 */
	@Column({
		type: 'json',
		nullable: true,
	})
	cookies: Array<{
		name: string;
		value: string;
		domain?: string;
		path?: string;
		secure?: boolean;
		httpOnly?: boolean;
		sameSite?: 'Strict' | 'Lax' | 'None';
		expires?: number;
	}>;

	/**
	 * LocalStorage items to be injected after the page has loaded.
	 */
	@Column({
		type: 'json',
		nullable: true,
	})
	localStorage: Record<string, string>;

	/**
	 * Itens de sessionStorage a serem injetados após carregamento da página.
	 */
	@Column({
		type: 'json',
		nullable: true,
	})
	sessionStorage: Record<string, string>;

	/**
	 * Se deve recarregar a página após injetar localStorage/sessionStorage.
	 * Alguns sites leem configurações apenas no carregamento inicial.
	 */
	@Column({
		type: 'boolean',
		default: false,
	})
	reloadAfterStorageInjection: boolean;

	/**
	 * Habilita timeouts adaptativos baseados no tamanho da página.
	 * Páginas mais longas recebem automaticamente timeouts maiores.
	 */
	@Column({
		type: 'boolean',
		default: true,
	})
	enableAdaptiveTimeouts: boolean;

	/**
	 * Multiplicadores customizados para timeouts por tamanho de página.
	 * Se não especificado, usa valores padrão: small=1.0, medium=1.5, large=2.0, huge=3.0
	 * Ex: { "small": 1.0, "medium": 2.0, "large": 3.0, "huge": 4.0 }
	 */
	@Column({
		type: 'json',
		nullable: true,
	})
	timeoutMultipliers: Record<string, number>;

	@CreateDateColumn()
	createdAt: Date;

	@UpdateDateColumn()
	updatedAt: Date;
}
