import { Controller, Get, Logger } from '@nestjs/common';
import { PasswordEncryption } from 'src/encryption/password-encryption.provider';
import { PasswordMigrationService } from 'src/encryption/password-migration.service';

@Controller('auth/password-migration')
export class PasswordMigrationController {
	private readonly logger = new Logger(PasswordMigrationController.name);

	constructor(
		private readonly passwordMigration: PasswordMigrationService,
		private readonly passwordEncryption: PasswordEncryption,
	) {}

	@Get('status')
	async getMigrationStatus() {
		const stats = await this.passwordMigration.getHashingStatistics();
		const currentAlgorithm = this.passwordEncryption.getAlgorithm();

		const totalUsers = Object.values(stats).reduce(
			(sum, count) => sum + count,
			0,
		);

		const needsMigration = Object.entries(stats)
			.filter(([algo]) => algo !== currentAlgorithm)
			.reduce((sum, [, count]) => sum + count, 0);

		const migrationProgress =
			totalUsers > 0
				? ((totalUsers - needsMigration) / totalUsers) * 100
				: 100;

		this.logger.log(
			`Migration status requested: ${migrationProgress.toFixed(1)}% complete`,
		);

		return {
			currentAlgorithm,
			totalUsers,
			needsMigration,
			migrationProgress: `${migrationProgress.toFixed(1)}%`,
			statistics: stats,
			details: {
				scrypt: {
					count: stats.scrypt,
					status:
						currentAlgorithm === 'scrypt' ? 'current' : 'legacy',
					description: 'Algoritmo nativo do Node.js, memory-hard',
				},
				bcrypt: {
					count: stats.bcrypt,
					status:
						currentAlgorithm === 'bcrypt' ? 'current' : 'legacy',
					description: 'Algoritmo amplamente testado e utilizado',
				},
				argon2: {
					count: stats.argon2,
					status:
						currentAlgorithm === 'argon2' ? 'current' : 'future',
					description: 'Estado da arte em segurança (recomendado)',
				},
				unknown: {
					count: stats.unknown,
					status: 'error',
					description: 'Formato de hash não reconhecido',
				},
			},
			migrationStrategy: {
				type: 'lazy-migration',
				description:
					'Senhas são migradas automaticamente no próximo login bem-sucedido',
				impact: 'zero-downtime',
			},
		};
	}

	@Get('current-algorithm')
	async getCurrentAlgorithm() {
		const algorithm = this.passwordEncryption.getAlgorithm();

		const algorithmInfo = {
			scrypt: {
				name: 'Scrypt',
				security: 'Alta',
				performance: 'Média',
				memoryUsage: 'Alto',
				dependencies: 'Nativo (sem dependências)',
				recommendation: 'Boa escolha padrão',
			},
			bcrypt: {
				name: 'Bcrypt',
				security: 'Alta',
				performance: 'Lenta',
				memoryUsage: 'Baixo',
				dependencies: 'npm install bcrypt',
				recommendation: 'Padrão da indústria',
			},
			argon2: {
				name: 'Argon2',
				security: 'Muito Alta',
				performance: 'Configurável',
				memoryUsage: 'Configurável',
				dependencies: 'npm install argon2',
				recommendation: 'Máxima segurança (recomendado)',
			},
		};

		return {
			algorithm,
			info: algorithmInfo[algorithm] || { name: 'Unknown' },
		};
	}
}
