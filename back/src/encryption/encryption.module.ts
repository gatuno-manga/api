import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PasswordEncryption } from './password-encryption.provider';
import { PasswordMigrationService } from './password-migration.service';
import { AppConfigModule } from 'src/app-config/app-config.module';
import { AppConfigService } from 'src/app-config/app-config.service';
import { ScryptStrategy, BcryptStrategy, Argon2Strategy, HybridStrategy } from './strategies';
import { User } from 'src/users/entitys/user.entity';

@Module({
	imports: [
		AppConfigModule,
		TypeOrmModule.forFeature([User]),
	],
	providers: [
		AppConfigService,
		ScryptStrategy,
		BcryptStrategy,
		Argon2Strategy,
		HybridStrategy,
		{
			provide: 'PASSWORD_HASHER',
			useClass: HybridStrategy,
		},
		PasswordEncryption,
		PasswordMigrationService,
	],
	exports: [PasswordEncryption, PasswordMigrationService],
})
export class EncryptionModule {}
