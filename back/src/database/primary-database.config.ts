import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { AppConfigService } from 'src/app-config/app-config.service';
import { DatabaseType } from './database-types';

export const config = (
	configService: AppConfigService,
): TypeOrmModuleOptions => ({
	type: configService.database.type as DatabaseType,
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
	extra: {
		min: 1,
		max: 20,
		idleTimeoutMillis: 10000,
		connectionTimeoutMillis: 2000,
	},
});
