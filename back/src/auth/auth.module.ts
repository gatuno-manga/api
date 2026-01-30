import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PasswordMigrationController } from './password-migration.controller';
import { AppConfigModule } from 'src/app-config/app-config.module';
import { EncryptionModule } from 'src/encryption/encryption.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from 'src/users/entitys/user.entity';
import { JwtModule } from '@nestjs/jwt';
import { AppConfigService } from 'src/app-config/app-config.service';
import { JwtStrategy } from './strategy/jwt.strategy';
import { JwtAuthGuard } from './guard/jwt-auth.guard';
import { WsJwtGuard } from './guard/ws-jwt.guard';
import { PassportModule } from '@nestjs/passport';
import { DataEncryptionProvider } from 'src/encryption/data-encryption.provider';
import { JwtRefreshStrategy } from './strategy/jwt-refresh.strategy';
import { CreateAdminEvent } from './events/create-admin.event';
import { Role } from 'src/users/entitys/role.entity';
import { TokenStoreService } from './services/token-store.service';

@Module({
	imports: [
		EncryptionModule,
		AppConfigModule,
		PassportModule,
		TypeOrmModule.forFeature([User, Role]),
		JwtModule.registerAsync({
			imports: [AppConfigModule],
			inject: [AppConfigService],
			useFactory: async (appConfigService: AppConfigService) => ({
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
		TokenStoreService,
		DataEncryptionProvider,
		JwtStrategy,
		JwtAuthGuard,
		WsJwtGuard,
		JwtRefreshStrategy,
	],
	exports: [JwtModule, JwtStrategy, JwtAuthGuard, WsJwtGuard],
})
export class AuthModule {}
