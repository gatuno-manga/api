import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import pLimit from 'p-limit';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';
import { AppConfigService } from '../src/infrastructure/app-config/app-config.service';
import { getImageDimensions } from '../src/common/utils/image.utils';

async function updateDimensions() {
	const app = await NestFactory.createApplicationContext(AppModule);
	const dataSource = app.get(DataSource);
	const configService = app.get(ConfigService);
	const appConfigService = app.get(AppConfigService);

	const s3 = new S3Client({
		endpoint: appConfigService.rustfs.endpoint,
		region: configService.get<string>('RUSTFS_REGION', 'us-east-1'),
		credentials: {
			accessKeyId: configService.get<string>(
				'RUSTFS_ACCESS_KEY',
				'rustfsadmin',
			),
			secretAccessKey: configService.get<string>(
				'RUSTFS_SECRET_KEY',
				'rustfsadmin',
			),
		},
		forcePathStyle: true,
	});

	const limit = pLimit(10);

	console.log('🚀 Iniciando atualização de dimensões das imagens...');

	const tables = [
		{ name: 'pages', column: 'path', bucket: 'books' },
		{ name: 'covers', column: 'url', bucket: 'books' },
		{ name: 'user_images', column: 'path', bucket: 'users' },
	];

	for (const table of tables) {
		console.log(`\n🔍 Tabela: ${table.name}`);

		const records = await dataSource.query(
			`SELECT id, \`${table.column}\` as path FROM \`${table.name}\` WHERE width IS NULL OR height IS NULL`,
		);

		console.log(
			`   -> Encontrados ${records.length} registros sem dimensões.`,
		);

		let updatedCount = 0;
		let errorCount = 0;

		const tasks = records.map((record) =>
			limit(async () => {
				try {
					const response = await s3.send(
						new GetObjectCommand({
							Bucket: table.bucket,
							Key: record.path,
						}),
					);

					if (!response.Body) {
						console.error(
							`      ⚠️ Corpo vazio para ${record.path}`,
						);
						return;
					}

					const buffer = Buffer.from(
						await response.Body.transformToByteArray(),
					);
					const dimensions = await getImageDimensions(buffer);

					if (dimensions) {
						await dataSource.query(
							`UPDATE \`${table.name}\` SET width = ?, height = ? WHERE id = ?`,
							[dimensions.width, dimensions.height, record.id],
						);
						updatedCount++;
					}
				} catch (err) {
					errorCount++;
					if (err.name !== 'NoSuchKey') {
						console.error(
							`      ❌ Erro ao processar ${record.path}:`,
							err.message,
						);
					}
				}
			}),
		);

		await Promise.all(tasks);
		console.log(
			`   ✅ Tabela ${table.name} finalizada. Sucesso: ${updatedCount}, Erros: ${errorCount}`,
		);
	}

	console.log('\n🎉 Todas as dimensões foram atualizadas com sucesso!');
	await app.close();
}

updateDimensions().catch((err) => {
	console.error('❌ Erro fatal:', err);
	process.exit(1);
});
