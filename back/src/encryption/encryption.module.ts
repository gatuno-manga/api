import { Module } from '@nestjs/common';
import { PasswordEncryption } from './password-encryption.provider';
import { AppConfigModule } from 'src/app-config/app-config.module';
import { AppConfigService } from 'src/app-config/app-config.service';

@Module({
	imports: [AppConfigModule],
	providers: [AppConfigService, PasswordEncryption],
	exports: [PasswordEncryption],
})
export class EncryptionModule {}
