import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { getOptionsToken } from '@nestjs/throttler';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Cache } from 'cache-manager';
import cookieParser from 'cookie-parser';
import { AppModule } from 'src/app.module';
import { AppConfigService } from 'src/infrastructure/app-config/app-config.service';
import { configureValidationPipe } from 'src/infrastructure/http/config/validation-pipe.config';
import { RolesEnum } from 'src/users/domain/enums/roles.enum';
import { Role } from 'src/users/infrastructure/database/entities/role.entity';
import { RbacSeederService } from 'src/users/infrastructure/seeding/rbac-seeder.service';
import { Repository } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';

export interface E2EAppOptions {
	/**
	 * Keep the AppModule throttlers. Off by default so the number of requests
	 * in a file never decides whether its tests pass; only the throttler's own
	 * e2e test turns it on.
	 */
	throttle?: boolean;
}

// Mirrors the private key in UserPermissionsService.getGuestCacheKey().
const GUEST_PERMISSIONS_CACHE_KEY = 'role-permissions:guest';
const RBAC_SEED_ATTEMPTS = 5;
const RBAC_SEED_RETRY_MS = 500;

export async function createE2EApp({
	throttle = false,
}: E2EAppOptions = {}): Promise<INestApplication> {
	const builder = Test.createTestingModule({ imports: [AppModule] });
	if (!throttle) {
		// An empty throttler list leaves the guard nothing to count, which
		// also disables per-route @Throttle overrides.
		builder
			.overrideProvider(getOptionsToken())
			.useValue({ throttlers: [] });
	}
	const moduleFixture: TestingModule = await builder.compile();

	const app = moduleFixture.createNestApplication();
	configureValidationPipe(app);
	app.use(cookieParser());
	app.setGlobalPrefix('api');
	await app.init();
	await ensureRbacSeeded(app);
	return app;
}

/**
 * AppModule emits `app.ready` without awaiting its listeners, so on a fresh
 * database the first request can reach PermissionsGuard before the guest role
 * exists, and the empty guest permission list is then cached for an hour.
 * Run the (idempotent) seeder to completion and drop that cache entry.
 */
async function ensureRbacSeeded(app: INestApplication): Promise<void> {
	const seeder = app.get(RbacSeederService);
	const roles = app.get<Repository<Role>>(getRepositoryToken(Role));

	for (let attempt = 1; attempt <= RBAC_SEED_ATTEMPTS; attempt++) {
		// seed() logs and swallows errors, such as a unique-key clash with
		// the `app.ready` run seeding at the same time; the check below
		// decides whether another attempt is needed.
		await seeder.seed();
		const guest = await roles.findOne({
			where: { name: RolesEnum.GUEST },
			relations: ['permissions'],
		});
		if (guest?.permissions?.length) {
			await app
				.get<Cache>(CACHE_MANAGER)
				.del(GUEST_PERMISSIONS_CACHE_KEY);
			return;
		}
		await new Promise((resolve) => setTimeout(resolve, RBAC_SEED_RETRY_MS));
	}
	throw new Error('RBAC seeding did not create the guest role permissions');
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
