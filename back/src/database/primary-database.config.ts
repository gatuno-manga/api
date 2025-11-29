import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { AppConfigService } from 'src/app-config/app-config.service';
import { ReplicationDatabaseType } from './database-types';

export const config = (
	configService: AppConfigService,
): TypeOrmModuleOptions => ({
	type: configService.database.type as ReplicationDatabaseType,
	replication: {
		master: {
			host: configService.database.host,
			port: configService.database.port,
			username: configService.database.username,
			password: configService.database.password,
			database: configService.database.name,
		},
		slaves: configService.database.slaveHosts.map((host) => ({
			host,
			port: configService.database.port,
			username: configService.database.username,
			password: configService.database.password,
			database: configService.database.name,
		})),
	},
	entities: [__dirname + '/../**/*.entity{.ts,.js}'],
	synchronize: true,
	poolSize: 20,
	extra: {
		connectionLimit: 20,
		waitForConnections: true,
		queueLimit: 0,
		connectTimeout: 10000,
	},
	maxQueryExecutionTime: 5000,
	retryAttempts: 10,
	retryDelay: 3000,
});
