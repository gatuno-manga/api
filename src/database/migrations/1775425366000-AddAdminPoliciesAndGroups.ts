import {
	MigrationInterface,
	QueryRunner,
	Table,
	TableColumn,
	TableForeignKey,
	TableIndex,
} from 'typeorm';

export class AddAdminPoliciesAndGroups1775425366000
	implements MigrationInterface
{
	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.addColumns('users', [
			new TableColumn({
				name: 'isBanned',
				type: 'boolean',
				default: false,
			}),
			new TableColumn({
				name: 'suspendedUntil',
				type: 'datetime',
				isNullable: true,
			}),
			new TableColumn({
				name: 'suspensionReason',
				type: 'varchar',
				length: '255',
				isNullable: true,
			}),
		]);

		await queryRunner.createTable(
			new Table({
				name: 'user_groups',
				columns: [
					{
						name: 'id',
						type: 'varchar',
						length: '36',
						isPrimary: true,
						generationStrategy: 'uuid',
						default: '(UUID())',
					},
					{
						name: 'name',
						type: 'varchar',
						isUnique: true,
					},
					{
						name: 'description',
						type: 'varchar',
						length: '255',
						isNullable: true,
					},
					{
						name: 'defaultMaxWeightSensitiveContent',
						type: 'int',
						default: 4,
					},
					{
						name: 'createdAt',
						type: 'datetime',
						default: 'CURRENT_TIMESTAMP',
					},
					{
						name: 'updatedAt',
						type: 'datetime',
						default: 'CURRENT_TIMESTAMP',
						onUpdate: 'CURRENT_TIMESTAMP',
					},
				],
			}),
		);

		await queryRunner.createTable(
			new Table({
				name: 'users_groups',
				columns: [
					{
						name: 'usersId',
						type: 'varchar',
						length: '36',
						isPrimary: true,
					},
					{
						name: 'userGroupsId',
						type: 'varchar',
						length: '36',
						isPrimary: true,
					},
				],
			}),
		);

		await queryRunner.createForeignKeys('users_groups', [
			new TableForeignKey({
				columnNames: ['usersId'],
				referencedTableName: 'users',
				referencedColumnNames: ['id'],
				onDelete: 'CASCADE',
			}),
			new TableForeignKey({
				columnNames: ['userGroupsId'],
				referencedTableName: 'user_groups',
				referencedColumnNames: ['id'],
				onDelete: 'CASCADE',
			}),
		]);

		await queryRunner.createTable(
			new Table({
				name: 'access_policies',
				columns: [
					{
						name: 'id',
						type: 'varchar',
						length: '36',
						isPrimary: true,
						generationStrategy: 'uuid',
						default: '(UUID())',
					},
					{ name: 'effect', type: 'varchar' },
					{ name: 'scope', type: 'varchar' },
					{
						name: 'targetUserId',
						type: 'varchar',
						length: '36',
						isNullable: true,
					},
					{
						name: 'targetGroupId',
						type: 'varchar',
						length: '36',
						isNullable: true,
					},
					{
						name: 'bookId',
						type: 'varchar',
						length: '36',
						isNullable: true,
					},
					{
						name: 'tagId',
						type: 'varchar',
						length: '36',
						isNullable: true,
					},
					{
						name: 'sensitiveContentId',
						type: 'varchar',
						length: '36',
						isNullable: true,
					},
					{
						name: 'isActive',
						type: 'boolean',
						default: true,
					},
					{
						name: 'overrideMaxWeightSensitiveContent',
						type: 'int',
						isNullable: true,
					},
					{
						name: 'reason',
						type: 'text',
						isNullable: true,
					},
					{
						name: 'expiresAt',
						type: 'datetime',
						isNullable: true,
					},
					{
						name: 'createdByUserId',
						type: 'varchar',
						length: '36',
						isNullable: true,
					},
					{
						name: 'createdAt',
						type: 'datetime',
						default: 'CURRENT_TIMESTAMP',
					},
					{
						name: 'updatedAt',
						type: 'datetime',
						default: 'CURRENT_TIMESTAMP',
						onUpdate: 'CURRENT_TIMESTAMP',
					},
				],
			}),
		);

		await queryRunner.createForeignKeys('access_policies', [
			new TableForeignKey({
				columnNames: ['targetUserId'],
				referencedTableName: 'users',
				referencedColumnNames: ['id'],
				onDelete: 'CASCADE',
			}),
			new TableForeignKey({
				columnNames: ['targetGroupId'],
				referencedTableName: 'user_groups',
				referencedColumnNames: ['id'],
				onDelete: 'CASCADE',
			}),
			new TableForeignKey({
				columnNames: ['bookId'],
				referencedTableName: 'books',
				referencedColumnNames: ['id'],
				onDelete: 'CASCADE',
			}),
			new TableForeignKey({
				columnNames: ['tagId'],
				referencedTableName: 'tags',
				referencedColumnNames: ['id'],
				onDelete: 'CASCADE',
			}),
			new TableForeignKey({
				columnNames: ['sensitiveContentId'],
				referencedTableName: 'sensitive_content',
				referencedColumnNames: ['id'],
				onDelete: 'CASCADE',
			}),
			new TableForeignKey({
				columnNames: ['createdByUserId'],
				referencedTableName: 'users',
				referencedColumnNames: ['id'],
				onDelete: 'SET NULL',
			}),
		]);

		await queryRunner.createIndices('access_policies', [
			new TableIndex({
				name: 'IDX_access_policies_target_user',
				columnNames: ['targetUserId'],
			}),
			new TableIndex({
				name: 'IDX_access_policies_target_group',
				columnNames: ['targetGroupId'],
			}),
			new TableIndex({
				name: 'IDX_access_policies_scope_effect_active',
				columnNames: ['scope', 'effect', 'isActive'],
			}),
		]);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.dropIndex(
			'access_policies',
			'IDX_access_policies_scope_effect_active',
		);
		await queryRunner.dropIndex(
			'access_policies',
			'IDX_access_policies_target_group',
		);
		await queryRunner.dropIndex(
			'access_policies',
			'IDX_access_policies_target_user',
		);

		await queryRunner.dropTable('access_policies');
		await queryRunner.dropTable('users_groups');
		await queryRunner.dropTable('user_groups');

		await queryRunner.dropColumn('users', 'suspensionReason');
		await queryRunner.dropColumn('users', 'suspendedUntil');
		await queryRunner.dropColumn('users', 'isBanned');
	}
}
