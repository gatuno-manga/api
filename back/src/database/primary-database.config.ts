import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { AppConfigService } from 'src/app-config/app-config.service';
import { DatabaseType } from './database-types';

export const config = (
	configService: AppConfigService,
): TypeOrmModuleOptions => ({
	type: configService.database.type as DatabaseType,
	host: configService.database.host,
	port: configService.database.port,
	username: configService.database.username,
	password: configService.database.password,
	database: configService.database.name,
	entities: [__dirname + '/../**/*.entity{.ts,.js}'],
	synchronize: true,
});
