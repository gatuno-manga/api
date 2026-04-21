import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfigModule } from 'src/infrastructure/app-config/app-config.module';
import { AppConfigService } from 'src/infrastructure/app-config/app-config.service';
import { DataEncryptionProvider } from 'src/infrastructure/encryption/data-encryption.provider';
import { EncryptionModule } from 'src/infrastructure/encryption/encryption.module';
import { LoggingModule } from 'src/infrastructure/logging/logging.module';
import { Role } from 'src/users/entities/role.entity';
import { User } from 'src/users/entities/user.entity';
import { AuthController } from './infrastructure/controllers/auth.controller';
import { AuthService } from './auth.service';
import { CreateAdminEvent } from './events/create-admin.event';
import { AuthAuditLog } from './infrastructure/database/entities/auth-audit-log.entity';
import { AuthSession } from './infrastructure/database/entities/auth-session.entity';
import { LoginApiKey } from './infrastructure/database/entities/login-api-key.entity';
import { UserMfa } from './infrastructure/database/entities/user-mfa.entity';
import { WebAuthnCredential } from './infrastructure/database/entities/webauthn-credential.entity';
import { JwtAuthGuard } from './infrastructure/framework/jwt-auth.guard';
import { WsJwtGuard } from './infrastructure/framework/ws-jwt.guard';
import { PasswordMigrationController } from './infrastructure/controllers/password-migration.controller';
import { MfaService } from './infrastructure/adapters/mfa.service';
import { SessionAuditService } from './infrastructure/adapters/session-audit.service';
import { SessionManagementService } from './infrastructure/adapters/session-management.service';
import { TokenStoreService } from './infrastructure/adapters/token-store.service';
import { WebauthnService } from './infrastructure/adapters/webauthn.service';
import { JwtRefreshStrategy } from './infrastructure/framework/jwt-refresh.strategy';
import { JwtStrategy } from './infrastructure/framework/jwt.strategy';

import { SignUpUseCase } from './application/use-cases/sign-up.use-case';
import { SignInUseCase } from './application/use-cases/sign-in.use-case';
import { TypeOrmUserRepositoryAdapter } from './infrastructure/adapters/typeorm-user-repository.adapter';

@Module({
	imports: [
		EncryptionModule,
		LoggingModule,
		AppConfigModule,
		PassportModule,
		TypeOrmModule.forFeature([
			User,
			Role,
			AuthSession,
			AuthAuditLog,
			LoginApiKey,
			WebAuthnCredential,
			UserMfa,
		]),
		JwtModule.registerAsync({
			imports: [AppConfigModule],
			inject: [AppConfigService],
			useFactory: (appConfigService: AppConfigService) => ({
				secret: appConfigService.jwt.accessSecret,
				signOptions: {
					expiresIn: appConfigService.jwt.accessExpiration,
				},
			}),
		}),
	],
	controllers: [AuthController, PasswordMigrationController],
	providers: [
		CreateAdminEvent,
		AuthService,
		SignUpUseCase,
		SignInUseCase,
		{
			provide: 'UserRepositoryPort',
			useClass: TypeOrmUserRepositoryAdapter,
		},
		SessionAuditService,
		SessionManagementService,
		TokenStoreService,
		MfaService,
		WebauthnService,
		DataEncryptionProvider,
		JwtStrategy,
		JwtAuthGuard,
		WsJwtGuard,
		JwtRefreshStrategy,
	],
	exports: [
		JwtModule,
		JwtStrategy,
		JwtAuthGuard,
		WsJwtGuard,
		SignUpUseCase,
		SignInUseCase,
	],
})
export class AuthModule {}
