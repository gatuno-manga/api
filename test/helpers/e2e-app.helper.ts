import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { v7 as uuidv7 } from 'uuid';
import cookieParser from 'cookie-parser';
import { JwtService } from '@nestjs/jwt';
import { AppConfigService } from 'src/infrastructure/app-config/app-config.service';
import { AppModule } from 'src/app.module';
import { configureValidationPipe } from 'src/infrastructure/http/config/validation-pipe.config';

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
