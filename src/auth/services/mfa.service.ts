import {
	BadRequestException,
	Injectable,
	UnauthorizedException,
} from '@nestjs/common';
import {
	createCipheriv,
	createDecipheriv,
	createHash,
	randomBytes,
} from 'node:crypto';
import { authenticator } from 'otplib';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppConfigService } from 'src/app-config/app-config.service';
import { PasswordEncryption } from 'src/encryption/password-encryption.provider';
import { User } from 'src/users/entities/user.entity';
import { UserMfa } from '../entities/user-mfa.entity';

interface MfaStatusResult {
	totpEnabled: boolean;
	backupCodesRemaining: number;
}

@Injectable()
export class MfaService {
	constructor(
		@InjectRepository(UserMfa)
		private readonly userMfaRepository: Repository<UserMfa>,
		@InjectRepository(User)
		private readonly userRepository: Repository<User>,
		private readonly appConfig: AppConfigService,
		private readonly passwordEncryption: PasswordEncryption,
	) {
		authenticator.options = {
			step: 30,
			window: 1,
		};
	}

	private getEncryptionKey(): Buffer {
		return createHash('sha256')
			.update(this.appConfig.mfaEncryptionSecret)
			.digest();
	}

	private encryptSecret(secret: string): string {
		const iv = randomBytes(12);
		const key = this.getEncryptionKey();
		const cipher = createCipheriv('aes-256-gcm', key, iv);
		const encrypted = Buffer.concat([
			cipher.update(secret, 'utf8'),
			cipher.final(),
		]);
		const authTag = cipher.getAuthTag();
		return `${iv.toString('hex')}.${authTag.toString('hex')}.${encrypted.toString('hex')}`;
	}

	private decryptSecret(payload: string): string {
		const [ivHex, tagHex, encryptedHex] = payload.split('.');
		if (!ivHex || !tagHex || !encryptedHex) {
			throw new BadRequestException('Invalid MFA secret format');
		}

		const key = this.getEncryptionKey();
		const decipher = createDecipheriv(
			'aes-256-gcm',
			key,
			Buffer.from(ivHex, 'hex'),
		);
		decipher.setAuthTag(Buffer.from(tagHex, 'hex'));

		const decrypted = Buffer.concat([
			decipher.update(Buffer.from(encryptedHex, 'hex')),
			decipher.final(),
		]);

		return decrypted.toString('utf8');
	}

	private async getOrCreateConfig(userId: string): Promise<UserMfa> {
		const existing = await this.userMfaRepository.findOne({
			where: { userId },
		});
		if (existing) {
			return existing;
		}

		return this.userMfaRepository.save(
			this.userMfaRepository.create({
				userId,
				isTotpEnabled: false,
				totpSecretEncrypted: null,
				backupCodesHash: [],
				backupCodesUsed: 0,
				lastVerifiedAt: null,
			}),
		);
	}

	async isTotpEnabled(userId: string): Promise<boolean> {
		const config = await this.userMfaRepository.findOne({
			where: { userId, isTotpEnabled: true },
		});
		return Boolean(config);
	}

	async getStatus(userId: string): Promise<MfaStatusResult> {
		const config = await this.userMfaRepository.findOne({
			where: { userId },
		});
		if (!config) {
			return {
				totpEnabled: false,
				backupCodesRemaining: 0,
			};
		}

		return {
			totpEnabled: config.isTotpEnabled,
			backupCodesRemaining: config.backupCodesHash?.length ?? 0,
		};
	}

	async beginTotpSetup(
		userId: string,
	): Promise<{ secret: string; otpauthUri: string }> {
		const user = await this.userRepository.findOne({
			where: { id: userId },
			select: ['id', 'email'],
		});
		if (!user) {
			throw new UnauthorizedException('User not found');
		}

		const config = await this.getOrCreateConfig(userId);
		const secret = authenticator.generateSecret();
		const encryptedSecret = this.encryptSecret(secret);
		const otpauthUri = authenticator.keyuri(
			user.email,
			this.appConfig.mfaIssuerName,
			secret,
		);

		config.totpSecretEncrypted = encryptedSecret;
		config.isTotpEnabled = false;
		config.backupCodesHash = [];
		config.backupCodesUsed = 0;
		config.lastVerifiedAt = null;

		await this.userMfaRepository.save(config);
		return {
			secret,
			otpauthUri,
		};
	}

	private async generateBackupCodes(): Promise<{
		plainCodes: string[];
		hashedCodes: string[];
	}> {
		const plainCodes = Array.from({ length: 8 }, () =>
			randomBytes(4).toString('hex').toUpperCase(),
		);

		const hashedCodes = await Promise.all(
			plainCodes.map((code) => this.passwordEncryption.encrypt(code)),
		);

		return { plainCodes, hashedCodes };
	}

	async verifyTotpSetup(
		userId: string,
		code: string,
	): Promise<{ enabled: boolean; backupCodes: string[] }> {
		const config = await this.getOrCreateConfig(userId);
		if (!config.totpSecretEncrypted) {
			throw new BadRequestException('MFA setup not started');
		}

		const secret = this.decryptSecret(config.totpSecretEncrypted);
		const isValid = authenticator.verify({
			token: code,
			secret,
		});

		if (!isValid) {
			throw new UnauthorizedException('Invalid MFA verification code');
		}

		const { plainCodes, hashedCodes } = await this.generateBackupCodes();
		config.isTotpEnabled = true;
		config.backupCodesHash = hashedCodes;
		config.backupCodesUsed = 0;
		config.lastVerifiedAt = new Date();
		await this.userMfaRepository.save(config);

		return {
			enabled: true,
			backupCodes: plainCodes,
		};
	}

	private async consumeBackupCode(
		config: UserMfa,
		code: string,
	): Promise<boolean> {
		const backupCodes = config.backupCodesHash ?? [];
		for (let i = 0; i < backupCodes.length; i++) {
			if (await this.passwordEncryption.compare(backupCodes[i], code)) {
				backupCodes.splice(i, 1);
				config.backupCodesHash = backupCodes;
				config.backupCodesUsed = (config.backupCodesUsed ?? 0) + 1;
				config.lastVerifiedAt = new Date();
				await this.userMfaRepository.save(config);
				return true;
			}
		}

		return false;
	}

	async verifyLoginCode(userId: string, code: string): Promise<boolean> {
		const config = await this.userMfaRepository.findOne({
			where: { userId, isTotpEnabled: true },
		});

		if (!config?.totpSecretEncrypted) {
			return false;
		}

		const secret = this.decryptSecret(config.totpSecretEncrypted);
		const validTotp = authenticator.verify({
			token: code,
			secret,
		});

		if (validTotp) {
			config.lastVerifiedAt = new Date();
			await this.userMfaRepository.save(config);
			return true;
		}

		return this.consumeBackupCode(config, code.toUpperCase());
	}

	async disableTotp(userId: string, code: string): Promise<void> {
		const config = await this.userMfaRepository.findOne({
			where: { userId, isTotpEnabled: true },
		});
		if (!config) {
			throw new BadRequestException('MFA is not enabled');
		}

		const canDisable = await this.verifyLoginCode(userId, code);
		if (!canDisable) {
			throw new UnauthorizedException('Invalid MFA verification code');
		}

		config.isTotpEnabled = false;
		config.totpSecretEncrypted = null;
		config.backupCodesHash = [];
		config.lastVerifiedAt = null;
		await this.userMfaRepository.save(config);
	}
}
