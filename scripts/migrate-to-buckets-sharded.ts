import { NestFactory } from '@nestjs/core';
import { AppModule } from '@/app.module';
import { DataSource } from 'typeorm';
import * as fs from 'node:fs';
import * as path from 'node:path';

async function migrate() {
	const app = await NestFactory.createApplicationContext(AppModule);
	const dataSource = app.get(DataSource);
	const queryRunner = dataSource.createQueryRunner();

	const DATA_DIR = path.join(process.cwd(), 'data');

	console.log('🚀 Iniciando migração profunda para Buckets...');
	console.log(`📂 Diretório de dados: ${DATA_DIR}`);

	const tables = [
		{
			name: 'users',
			columns: ['profileImagePath', 'profileBannerPath'],
			bucket: 'users',
		},
		{ name: 'covers', columns: ['url'], bucket: 'books' },
		{ name: 'pages', columns: ['path'], bucket: 'books' },
		{ name: 'chapters', columns: ['documentPath'], bucket: 'books' },
	];

	for (const table of tables) {
		console.log(`\n📦 Processando tabela: ${table.name}`);

		for (const column of table.columns) {
			// Query segura escapando nomes de tabela e coluna manualmente ou via query builder simplificado
			const records = await queryRunner.query(
				`SELECT id, \`${column}\` as path FROM \`${table.name}\` 
				 WHERE \`${column}\` IS NOT NULL 
				 AND \`${column}\` != '' 
				 AND \`${column}\` NOT LIKE ? 
				 AND \`${column}\` NOT LIKE 'http%'`,
				[`${table.bucket}/%`],
			);

			if (records.length === 0) continue;
			console.log(
				`   -> Coluna ${column}: ${records.length} registros para processar.`,
			);

			for (const record of records) {
				const oldPath = record.path
					.replace(/^\/?(api\/)?data\//, '')
					.replace(/^\//, '');
				const newPath = `${table.bucket}/${oldPath}`;

				const fullOldPath = path.join(DATA_DIR, oldPath);
				const fullNewPath = path.join(DATA_DIR, newPath);

				if (fs.existsSync(fullOldPath)) {
					fs.mkdirSync(path.dirname(fullNewPath), {
						recursive: true,
					});

					try {
						fs.renameSync(fullOldPath, fullNewPath);
						await queryRunner.query(
							`UPDATE \`${table.name}\` SET \`${column}\` = ? WHERE id = ?`,
							[newPath, record.id],
						);
					} catch (err) {
						console.error(
							`   ❌ Erro ao mover ${oldPath}:`,
							err.message,
						);
					}
				} else {
					// Mesmo que o arquivo não exista (ex: erro em migração anterior),
					// atualizamos o DB para o novo padrão de bucket
					await queryRunner.query(
						`UPDATE \`${table.name}\` SET \`${column}\` = ? WHERE id = ?`,
						[newPath, record.id],
					);
				}
			}
		}
	}

	// Limpeza: remover pastas de shards vazias na raiz
	console.log('\n🧹 Limpando pastas de shards vazias...');
	if (fs.existsSync(DATA_DIR)) {
		const entries = fs.readdirSync(DATA_DIR);
		for (const entry of entries) {
			// Apenas pastas de 2 chars hex
			if (/^[0-9a-f]{2}$/.test(entry)) {
				const shardPath = path.join(DATA_DIR, entry);
				try {
					if (fs.readdirSync(shardPath).length === 0) {
						fs.rmdirSync(shardPath);
						console.log(`   - Removida pasta vazia: ${entry}`);
					}
				} catch (e) {}
			}
		}
	}

	console.log('\n🎉 Migração concluída com sucesso!');
	await app.close();
}

migrate().catch((err) => {
	console.error('❌ Erro fatal na migração:', err);
	process.exit(1);
});
