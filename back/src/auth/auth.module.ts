import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfigModule } from 'src/app-config/app-config.module';
import { AppConfigService } from 'src/app-config/app-config.service';
import { DataEncryptionProvider } from 'src/encryption/data-encryption.provider';
import { EncryptionModule } from 'src/encryption/encryption.module';
import { LoggingModule } from 'src/logging/logging.module';
import { Role } from 'src/users/entities/role.entity';
import { User } from 'src/users/entities/user.entity';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { CreateAdminEvent } from './events/create-admin.event';
import { AuthAuditLog } from './entities/auth-audit-log.entity';
import { AuthSession } from './entities/auth-session.entity';
import { LoginApiKey } from './entities/login-api-key.entity';
import { UserMfa } from './entities/user-mfa.entity';
import { WebAuthnCredential } from './entities/webauthn-credential.entity';
import { JwtAuthGuard } from './guard/jwt-auth.guard';
import { WsJwtGuard } from './guard/ws-jwt.guard';
import { PasswordMigrationController } from './password-migration.controller';
import { MfaService } from './services/mfa.service';
import { SessionAuditService } from './services/session-audit.service';
import { SessionManagementService } from './services/session-management.service';
import { TokenStoreService } from './services/token-store.service';
import { WebauthnService } from './services/webauthn.service';
import { JwtRefreshStrategy } from './strategy/jwt-refresh.strategy';
import { JwtStrategy } from './strategy/jwt.strategy';

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
				secret: appConfigService.jwtAccessSecret,
				signOptions: {
					expiresIn: appConfigService.jwtAccessExpiration,
				},
			}),
		}),
	],
	controllers: [AuthController, PasswordMigrationController],
	providers: [
		CreateAdminEvent,
		AuthService,
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
	exports: [JwtModule, JwtStrategy, JwtAuthGuard, WsJwtGuard],
})
export class AuthModule {}
