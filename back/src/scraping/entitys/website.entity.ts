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
	 * Script para extrair informações de capítulos da página.
	 * Deve retornar um array de objetos {title, url, index}.
	 */
	@Column({
		type: 'text',
		nullable: true,
	})
	chapterExtractScript: string;

	@Column({
		type: 'json',
		nullable: true,
	})
	ignoreFiles: string[];

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

	@CreateDateColumn()
	createdAt: Date;

	@UpdateDateColumn()
	updatedAt: Date;
}
