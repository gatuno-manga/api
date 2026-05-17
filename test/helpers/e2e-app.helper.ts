import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { AppModule } from 'src/app.module';
import { AppConfigService } from 'src/infrastructure/app-config/app-config.service';
import { configureValidationPipe } from 'src/infrastructure/http/config/validation-pipe.config';
import { v7 as uuidv7 } from 'uuid';

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
			sub: uuidv7(),
			email: 'admin-e2e@gatuno.local',
			roles: ['admin'],
			maxWeightSensitiveContent: 99,
			sessionId: uuidv7(),
		},
		{
			issuer: configService.jwt.issuer,
			audience: configService.jwt.audience,
			expiresIn: '5m',
		},
	);
}
