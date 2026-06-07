import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfigModule } from 'src/infrastructure/app-config/app-config.module';
import { AppConfigService } from 'src/infrastructure/app-config/app-config.service';
import { EmailModule } from 'src/infrastructure/email/email.module';
import { DataEncryptionProvider } from 'src/infrastructure/encryption/data-encryption.provider';
import { EncryptionModule } from 'src/infrastructure/encryption/encryption.module';
import { LoggingModule } from 'src/infrastructure/logging/logging.module';
import { Role } from 'src/users/infrastructure/database/entities/role.entity';
import { User } from 'src/users/infrastructure/database/entities/user.entity';
import { RbacModule } from 'src/users/rbac.module';
import { ApiKeyUseCase } from './application/use-cases/api-key.use-case';
import { ForgotPasswordUseCase } from './application/use-cases/forgot-password.use-case';
import { RefreshTokenUseCase } from './application/use-cases/refresh-token.use-case';
import { ResetPasswordUseCase } from './application/use-cases/reset-password.use-case';
import { RevokeSessionUseCase } from './application/use-cases/revoke-session.use-case';
import { SignInUseCase } from './application/use-cases/sign-in.use-case';
import { SignOutUseCase } from './application/use-cases/sign-out.use-case';
import { SignUpUseCase } from './application/use-cases/sign-up.use-case';
import { AuthService } from './auth.service';
import { CreateAdminEvent } from './events/create-admin.event';
import { MfaService } from './infrastructure/adapters/mfa.service';
import { SessionAuditService } from './infrastructure/adapters/session-audit.service';
import { SessionManagementService } from './infrastructure/adapters/session-management.service';
import { TokenStoreService } from './infrastructure/adapters/token-store.service';
import { TypeOrmUserRepositoryAdapter } from './infrastructure/adapters/typeorm-user-repository.adapter';
import { WebauthnService } from './infrastructure/adapters/webauthn.service';
import { AuthController } from './infrastructure/controllers/auth.controller';
import { PasswordMigrationController } from './infrastructure/controllers/password-migration.controller';
import { AuthAuditLog } from './infrastructure/database/entities/auth-audit-log.entity';
import { AuthSession } from './infrastructure/database/entities/auth-session.entity';
import { LoginApiKey } from './infrastructure/database/entities/login-api-key.entity';
import { UserMfa } from './infrastructure/database/entities/user-mfa.entity';
import { WebAuthnCredential } from './infrastructure/database/entities/webauthn-credential.entity';
import { JwtAuthGuard } from './infrastructure/framework/jwt-auth.guard';
import { JwtRefreshStrategy } from './infrastructure/framework/jwt-refresh.strategy';
import { JwtStrategy } from './infrastructure/framework/jwt.strategy';
import { WsJwtGuard } from './infrastructure/framework/ws-jwt.guard';

@Module({
	imports: [
		EncryptionModule,
		LoggingModule,
		AppConfigModule,
		PassportModule,
		RbacModule,
		EmailModule,
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
		ForgotPasswordUseCase,
		ResetPasswordUseCase,
		RefreshTokenUseCase,
		SignOutUseCase,
		RevokeSessionUseCase,
		ApiKeyUseCase,
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
		RbacModule,
		SignUpUseCase,
		SignInUseCase,
		ForgotPasswordUseCase,
		ResetPasswordUseCase,
		RefreshTokenUseCase,
		SignOutUseCase,
		RevokeSessionUseCase,
		ApiKeyUseCase,
	],
})
export class AuthModule {}
