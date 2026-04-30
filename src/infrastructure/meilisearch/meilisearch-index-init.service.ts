import {
	Inject,
	Injectable,
	Logger,
	OnApplicationBootstrap,
} from '@nestjs/common';
import { Meilisearch } from 'meilisearch';
import { MEILI_CLIENT } from './meilisearch.constants';

@Injectable()
export class MeilisearchIndexInitService implements OnApplicationBootstrap {
	private readonly logger = new Logger(MeilisearchIndexInitService.name);

	constructor(
		@Inject(MEILI_CLIENT) private readonly meiliClient: Meilisearch,
	) {}

	async onApplicationBootstrap() {
		this.logger.log('Initializing Meilisearch indexes...');

		try {
			await Promise.all([
				this.setupBooksIndex(),
				this.setupAuthorsIndex(),
				this.setupTagsIndex(),
				this.setupUsersIndex(),
			]);
			this.logger.log('✅ Meilisearch indexes initialized successfully');
		} catch (error) {
			this.logger.error(
				`❌ Error initializing Meilisearch indexes: ${error.message}`,
			);
		}
	}

	private async setupBooksIndex() {
		const index = this.meiliClient.index('books');

		// Configura atributos filtráveis e pesquisáveis
		await index.updateSettings({
			filterableAttributes: [
				'type',
				'scrapingStatus',
				'publication',
				'authors',
				'tags',
				'sites',
			],
			searchableAttributes: [
				'title',
				'description',
				'authors',
				'tags',
				'sites',
			],
			rankingRules: [
				'words',
				'typo',
				'proximity',
				'attribute',
				'sort',
				'exactness',
				'publication:desc',
			],
		});

		this.logger.log('  → "books" index settings updated');
	}

	private async setupAuthorsIndex() {
		const index = this.meiliClient.index('authors');
		await index.updateSettings({
			searchableAttributes: ['name'],
			filterableAttributes: ['name'],
		});
		this.logger.log('  → "authors" index settings updated');
	}

	private async setupTagsIndex() {
		const index = this.meiliClient.index('tags');
		await index.updateSettings({
			searchableAttributes: ['name', 'altNames'],
			filterableAttributes: ['name'],
		});
		this.logger.log('  → "tags" index settings updated');
	}

	private async setupUsersIndex() {
		const index = this.meiliClient.index('users');
		await index.updateSettings({
			searchableAttributes: ['userName', 'name'],
			filterableAttributes: ['userName'],
		});
		this.logger.log('  → "users" index settings updated');
	}
}
