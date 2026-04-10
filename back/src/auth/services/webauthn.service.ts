import {
	BadRequestException,
	Inject,
	Injectable,
	UnauthorizedException,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import {
	generateAuthenticationOptions,
	generateRegistrationOptions,
	verifyAuthenticationResponse,
	verifyRegistrationResponse,
} from '@simplewebauthn/server';
import { isoBase64URL } from '@simplewebauthn/server/helpers';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppConfigService } from 'src/app-config/app-config.service';
import { User } from 'src/users/entities/user.entity';
import { WebAuthnCredential } from '../entities/webauthn-credential.entity';

type SupportedTransport =
	| 'ble'
	| 'cable'
	| 'hybrid'
	| 'internal'
	| 'nfc'
	| 'smart-card'
	| 'usb';

@Injectable()
export class WebauthnService {
	constructor(
		@Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
		@InjectRepository(User)
		private readonly userRepository: Repository<User>,
		@InjectRepository(WebAuthnCredential)
		private readonly credentialRepository: Repository<WebAuthnCredential>,
		private readonly configService: AppConfigService,
	) {}

	private registrationChallengeKey(userId: string): string {
		return `webauthn:register:challenge:${userId}`;
	}

	private authenticationChallengeKey(userId: string): string {
		return `webauthn:authenticate:challenge:${userId}`;
	}

	private normalizeTransports(
		transports?: string[] | null,
	): SupportedTransport[] {
		if (!transports || transports.length === 0) {
			return [];
		}

		const supported = new Set<SupportedTransport>([
			'ble',
			'cable',
			'hybrid',
			'internal',
			'nfc',
			'smart-card',
			'usb',
		]);

		return transports.filter((value): value is SupportedTransport =>
			supported.has(value as SupportedTransport),
		);
	}

	private async findUserById(userId: string): Promise<User> {
		const user = await this.userRepository.findOne({
			where: { id: userId },
		});
		if (!user) {
			throw new UnauthorizedException('User not found');
		}

		return user;
	}

	async beginRegistration(userId: string) {
		const user = await this.findUserById(userId);
		const existingCredentials = await this.credentialRepository.find({
			where: { userId },
		});

		const options = await generateRegistrationOptions({
			rpName: this.configService.webauthnRpName,
			rpID: this.configService.webauthnRpId,
			userName: user.email,
			timeout: this.configService.webauthnChallengeTtlMs,
			attestationType: 'none',
			authenticatorSelection: {
				residentKey: 'preferred',
				userVerification: 'preferred',
			},
			excludeCredentials: existingCredentials.map((credential) => ({
				id: credential.credentialId,
				transports:
					this.normalizeTransports(credential.transports) ||
					undefined,
			})),
			supportedAlgorithmIDs: [-7, -257],
		});

		await this.cacheManager.set(
			this.registrationChallengeKey(userId),
			options.challenge,
			this.configService.webauthnChallengeTtlMs,
		);

		return options;
	}

	async verifyRegistration(
		userId: string,
		response: Record<string, unknown>,
		name?: string,
	): Promise<{ id: string; credentialId: string; name: string | null }> {
		await this.findUserById(userId);
		const challengeKey = this.registrationChallengeKey(userId);
		const expectedChallenge =
			await this.cacheManager.get<string>(challengeKey);
		if (!expectedChallenge) {
			throw new UnauthorizedException(
				'Passkey registration challenge expired. Try again.',
			);
		}

		const verification = await verifyRegistrationResponse({
			response: response as never,
			expectedChallenge,
			expectedOrigin: this.configService.webauthnAllowedOrigins,
			expectedRPID: this.configService.webauthnRpId,
			requireUserVerification: true,
		});

		if (!verification.verified || !verification.registrationInfo) {
			throw new UnauthorizedException(
				'Passkey registration verification failed',
			);
		}

		const { credential, credentialDeviceType, credentialBackedUp } =
			verification.registrationInfo;

		const credentialId = credential.id;
		const existing = await this.credentialRepository.findOne({
			where: { credentialId },
		});

		const entity = existing
			? this.credentialRepository.merge(existing, {
					publicKey: isoBase64URL.fromBuffer(credential.publicKey),
					counter: credential.counter,
					deviceType: credentialDeviceType ?? null,
					backedUp: credentialBackedUp ?? false,
					name: name?.trim() || existing.name,
					lastUsedAt: null,
				})
			: this.credentialRepository.create({
					userId,
					credentialId,
					publicKey: isoBase64URL.fromBuffer(credential.publicKey),
					counter: credential.counter,
					deviceType: credentialDeviceType ?? null,
					backedUp: credentialBackedUp ?? false,
					transports: this.normalizeTransports(credential.transports),
					name: name?.trim() || null,
					lastUsedAt: null,
				});

		const saved = await this.credentialRepository.save(entity);
		await this.cacheManager.del(challengeKey);

		return {
			id: saved.id,
			credentialId: saved.credentialId,
			name: saved.name,
		};
	}

	async beginAuthentication(email: string) {
		const user = await this.userRepository.findOne({
			where: { email },
		});
		if (!user) {
			throw new UnauthorizedException('User not found');
		}

		const credentials = await this.credentialRepository.find({
			where: { userId: user.id },
		});
		if (credentials.length === 0) {
			throw new BadRequestException('User has no registered passkeys');
		}

		const options = await generateAuthenticationOptions({
			rpID: this.configService.webauthnRpId,
			timeout: this.configService.webauthnChallengeTtlMs,
			userVerification: 'preferred',
			allowCredentials: credentials.map((credential) => ({
				id: credential.credentialId,
				transports:
					this.normalizeTransports(credential.transports) ||
					undefined,
			})),
		});

		await this.cacheManager.set(
			this.authenticationChallengeKey(user.id),
			options.challenge,
			this.configService.webauthnChallengeTtlMs,
		);

		return options;
	}

	async verifyAuthentication(
		email: string,
		response: Record<string, unknown>,
	): Promise<User> {
		const user = await this.userRepository.findOne({
			where: { email },
			relations: ['roles'],
		});
		if (!user) {
			throw new UnauthorizedException('User not found');
		}

		const responseCredentialId = response.id;
		if (typeof responseCredentialId !== 'string') {
			throw new BadRequestException('Invalid passkey response');
		}

		const credential = await this.credentialRepository.findOne({
			where: { userId: user.id, credentialId: responseCredentialId },
		});
		if (!credential) {
			throw new UnauthorizedException('Passkey not found for this user');
		}

		const challengeKey = this.authenticationChallengeKey(user.id);
		const expectedChallenge =
			await this.cacheManager.get<string>(challengeKey);
		if (!expectedChallenge) {
			throw new UnauthorizedException(
				'Passkey authentication challenge expired. Try again.',
			);
		}

		const verification = await verifyAuthenticationResponse({
			response: response as never,
			expectedChallenge,
			expectedOrigin: this.configService.webauthnAllowedOrigins,
			expectedRPID: this.configService.webauthnRpId,
			credential: {
				id: credential.credentialId,
				publicKey: isoBase64URL.toBuffer(credential.publicKey),
				counter: credential.counter,
				transports:
					this.normalizeTransports(credential.transports) ||
					undefined,
			},
			requireUserVerification: true,
		});

		if (!verification.verified || !verification.authenticationInfo) {
			throw new UnauthorizedException(
				'Passkey authentication verification failed',
			);
		}

		credential.counter = verification.authenticationInfo.newCounter;
		credential.lastUsedAt = new Date();
		await this.credentialRepository.save(credential);
		await this.cacheManager.del(challengeKey);

		return user;
	}

	async listUserPasskeys(userId: string) {
		const credentials = await this.credentialRepository.find({
			where: { userId },
			order: { createdAt: 'DESC' },
		});

		return credentials.map((credential) => ({
			id: credential.id,
			credentialId: credential.credentialId,
			name: credential.name,
			deviceType: credential.deviceType,
			backedUp: credential.backedUp,
			lastUsedAt: credential.lastUsedAt,
			createdAt: credential.createdAt,
		}));
	}

	async deleteUserPasskey(
		userId: string,
		passkeyId: string,
	): Promise<boolean> {
		const credential = await this.credentialRepository.findOne({
			where: { id: passkeyId, userId },
		});
		if (!credential) {
			return false;
		}

		await this.credentialRepository.remove(credential);
		return true;
	}
}
