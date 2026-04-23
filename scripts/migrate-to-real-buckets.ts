import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import * as fs from 'node:fs';
import * as path from 'node:path';

async function migrate() {
	const app = await NestFactory.createApplicationContext(AppModule);
	const dataSource = app.get(DataSource);
	const queryRunner = dataSource.createQueryRunner();

	const DATA_DIR = path.join(process.cwd(), 'data');

	console.log('🚀 Iniciando migração para Múltiplos Buckets Reais...');
	console.log(`📂 Diretório raiz de dados: ${DATA_DIR}`);

	const buckets = ['books', 'users', 'processing', 'system'];

	for (const bucket of buckets) {
		const bucketPath = path.join(DATA_DIR, bucket);
		if (!fs.existsSync(bucketPath)) {
			console.log(`📦 Criando bucket físico: ${bucket}`);
			fs.mkdirSync(bucketPath, { recursive: true });
		}
	}

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
		console.log(`\n🔍 Tabela: ${table.name}`);

		for (const column of table.columns) {
			// Pegamos todos os registros
			const records = await queryRunner.query(
				`SELECT id, \`${column}\` as path FROM \`${table.name}\` WHERE \`${column}\` IS NOT NULL AND \`${column}\` != ''`,
			);

			console.log(`   -> Coluna ${column}: ${records.length} registros.`);

			for (const record of records) {
				const currentPath = record.path
					.replace(/^\/?(api\/)?data\//, '')
					.replace(/^\//, '');

				// Se o caminho já começa com o bucket (ex: "users/0a/uuid.webp"),
				// queremos extrair apenas a parte interna ("0a/uuid.webp") para o banco de dados,
				// já que o novo MediaUrlService agora lida com o bucket dinamicamente.

				let internalPath = currentPath;
				if (currentPath.startsWith(`${table.bucket}/`)) {
					internalPath = currentPath.substring(
						table.bucket.length + 1,
					);
				}

				const fullOldPath = path.join(DATA_DIR, currentPath);
				const fullNewPath = path.join(
					DATA_DIR,
					table.bucket,
					internalPath,
				);

				// 1. Mover arquivo fisicamente se necessário
				if (fs.existsSync(fullOldPath) && fullOldPath !== fullNewPath) {
					fs.mkdirSync(path.dirname(fullNewPath), {
						recursive: true,
					});
					try {
						fs.renameSync(fullOldPath, fullNewPath);
					} catch (err) {
						console.error(
							`      ❌ Erro ao mover ${currentPath}:`,
							err.message,
						);
					}
				}

				// 2. Atualizar Banco de Dados (Salvamos SEM o prefixo do bucket agora)
				await queryRunner.query(
					`UPDATE \`${table.name}\` SET \`${column}\` = ? WHERE id = ?`,
					[internalPath, record.id],
				);
			}
		}
	}

	console.log('\n🎉 Migração física e lógica concluída!');
	console.log(
		`⚠️  IMPORTANTE: No RustFS, os diretórios 'books', 'users', etc. agora são BUCKETS REAIS.`,
	);
	await app.close();
}

migrate().catch((err) => {
	console.error('❌ Erro fatal:', err);
	process.exit(1);
});
