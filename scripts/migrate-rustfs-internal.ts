import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';

async function migrate() {
	const app = await NestFactory.createApplicationContext(AppModule);
	const dataSource = app.get(DataSource);
	const queryRunner = dataSource.createQueryRunner();

	// Precisamos rodar isso onde temos acesso ao volume rustfs_data.
	// Como o container da API não monta o rustfs_data, vamos usar o MC para mover de gatuno-files para os novos buckets.
	// O gatuno-files já tem os arquivos no padrão shard/uuid.ext.

	console.log(
		'🚀 Iniciando movimentação interna do RustFS (Bucket-to-Bucket)...',
	);

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
			const records = await queryRunner.query(
				`SELECT id, \`${column}\` as path FROM \`${table.name}\` WHERE \`${column}\` IS NOT NULL AND \`${column}\` != ''`,
			);

			console.log(`   -> Coluna ${column}: ${records.length} registros.`);

			for (const record of records) {
				const internalPath = record.path;

				// Usamos o MC para mover os arquivos entre buckets no RustFS
				// mc mv myrustfs/gatuno-files/shard/uuid.ext myrustfs/bucket/shard/uuid.ext

				const src = `myrustfs/gatuno-files/${internalPath}`;
				const dest = `myrustfs/${table.bucket}/${internalPath}`;

				try {
					// Verificamos se o arquivo existe na origem antes de mover
					const checkCmd = `mc ls ${src}`;
					execSync(
						`docker run --rm --network gatuno_gatuno-net minio/mc sh -c "mc alias set myrustfs http://rustfs:9000 rustfsadmin rustfsadmin --api s3v4 && ${checkCmd}"`,
						{ stdio: 'ignore' },
					);

					const moveCmd = `mc mv ${src} ${dest}`;
					console.log(
						`      -> Movendo: ${internalPath} para bucket '${table.bucket}'`,
					);
					execSync(
						`docker run --rm --network gatuno_gatuno-net minio/mc sh -c "mc alias set myrustfs http://rustfs:9000 rustfsadmin rustfsadmin --api s3v4 && ${moveCmd}"`,
						{ stdio: 'inherit' },
					);
				} catch (err) {
					// console.log(`      ⚠️ Arquivo não encontrado ou já movido: ${internalPath}`);
				}
			}
		}
	}

	console.log('\n🎉 Migração entre buckets no RustFS concluída!');
	await app.close();
}

migrate().catch((err) => {
	console.error('❌ Erro fatal:', err);
	process.exit(1);
});
