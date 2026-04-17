import { execSync } from 'node:child_process';
import path from 'node:path';
import { ConsoleLogger, Logger } from '@nestjs/common';
import { config as loadEnvFile } from 'dotenv';

loadEnvFile({ path: path.resolve(__dirname, '../../.env') });
loadEnvFile({ path: path.resolve(__dirname, '../.env') });

const setEnvDefault = (key: string, value: string): void => {
	if (!process.env[key] || process.env[key]?.trim() === '') {
		process.env[key] = value;
	}
};

const detectDockerContainerIp = (containerName: string): string | null => {
	try {
		const ip = execSync(
			`docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' ${containerName}`,
			{
				stdio: ['ignore', 'pipe', 'ignore'],
				encoding: 'utf8',
			},
		).trim();
		return ip.length > 0 ? ip : null;
	} catch {
		return null;
	}
};

setEnvDefault('NODE_ENV', 'test');
setEnvDefault('DB_TYPE', 'mysql');
setEnvDefault('DB_NAME', 'gatuno');
setEnvDefault('DB_MASTER_HOST', '127.0.0.1');
setEnvDefault('DB_SLAVE_HOSTS', '127.0.0.1');
setEnvDefault('DB_PORT', process.env.DB_MASTER_EXTERNAL_PORT || '3306');
setEnvDefault('DB_USER', 'root');
setEnvDefault('DB_PASS', 'root');
setEnvDefault('API_URL', 'http://localhost:3000');
setEnvDefault('APP_URL', 'http://localhost:4200');
setEnvDefault('ALLOWED_URL', 'http://localhost:4200');
setEnvDefault(
	'REDIS_HOST',
	detectDockerContainerIp('gatuno-redis') || '127.0.0.1',
);
setEnvDefault('REDIS_PORT', '6379');
setEnvDefault('REDIS_PASSWORD', '');
setEnvDefault('USERADMIN_EMAIL', 'admin@example.com');
setEnvDefault('USERADMIN_PASSWORD', 'AdminP@ssw0rd!');
setEnvDefault('JWT_ACCESS_SECRET', 'default_secret');
setEnvDefault('JWT_REFRESH_SECRET', 'default_refresh_secret');

const shouldShowLogs = process.env.TEST_LOGS === 'true';

if (!shouldShowLogs) {
	Logger.overrideLogger(false);

	const noop = () => undefined;

	jest.spyOn(Logger, 'log').mockImplementation(noop);
	jest.spyOn(Logger, 'error').mockImplementation(noop);
	jest.spyOn(Logger, 'warn').mockImplementation(noop);
	jest.spyOn(Logger, 'debug').mockImplementation(noop);
	jest.spyOn(Logger, 'verbose').mockImplementation(noop);

	jest.spyOn(ConsoleLogger.prototype, 'log').mockImplementation(noop);
	jest.spyOn(ConsoleLogger.prototype, 'error').mockImplementation(noop);
	jest.spyOn(ConsoleLogger.prototype, 'warn').mockImplementation(noop);
	jest.spyOn(ConsoleLogger.prototype, 'debug').mockImplementation(noop);
	jest.spyOn(ConsoleLogger.prototype, 'verbose').mockImplementation(noop);

	jest.spyOn(console, 'log').mockImplementation(noop);
	jest.spyOn(console, 'info').mockImplementation(noop);
	jest.spyOn(console, 'warn').mockImplementation(noop);
	jest.spyOn(console, 'error').mockImplementation(noop);
	jest.spyOn(console, 'debug').mockImplementation(noop);
}
