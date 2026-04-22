import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Migration to add concurrencyLimit column to websites table.
 * This allows configuring per-site concurrency limits for scraping operations.
 *
 * Usage:
 *   npm run typeorm migration:run
 *
 * Rollback:
 *   npm run typeorm migration:revert
 */
export class AddConcurrencyLimitToWebsites1730822400000
	implements MigrationInterface
{
	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.addColumn(
			'websites',
			new TableColumn({
				name: 'concurrencyLimit',
				type: 'int',
				isNullable: true,
				default: null,
				comment:
					'Maximum number of simultaneous scraping operations allowed for this website. NULL = unlimited',
			}),
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.dropColumn('websites', 'concurrencyLimit');
	}
}
