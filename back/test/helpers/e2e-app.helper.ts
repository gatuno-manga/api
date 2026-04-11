import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import cookieParser from 'cookie-parser';
import { JwtService } from '@nestjs/jwt';
import { AppConfigService } from 'src/app-config/app-config.service';
import { AppModule } from 'src/app.module';
import { configureValidationPipe } from 'src/config/validation-pipe.config';

export async function createE2EApp(): Promise<INestApplication> {
	const moduleFixture: TestingModule = await Test.createTestingModule({
		imports: [AppModule],
	}).compile();

	const app = moduleFixture.createNestApplication();
	configureValidationPipe(app);
	app.use(cookieParser());
	app.setGlobalPrefix('api');
	await app.init();
	return app;
}

export function createAdminAccessToken(app: INestApplication): string {
	const jwtService = app.get(JwtService);
	const configService = app.get(AppConfigService);

	return jwtService.sign(
		{
			sub: randomUUID(),
			email: 'admin-e2e@gatuno.local',
			roles: ['admin'],
			maxWeightSensitiveContent: 99,
			sessionId: randomUUID(),
		},
		{
			issuer: configService.jwtIssuer,
			audience: configService.jwtAudience,
			expiresIn: '5m',
		},
	);
}
