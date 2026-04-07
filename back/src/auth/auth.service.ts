import {
	BadRequestException,
	Injectable,
	Logger,
	UnauthorizedException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { AppConfigService } from 'src/app-config/app-config.service';
import { DataEncryptionProvider } from 'src/encryption/data-encryption.provider';
import { PasswordEncryption } from 'src/encryption/password-encryption.provider';
import { PasswordMigrationService } from 'src/encryption/password-migration.service';
import { Role } from 'src/users/entities/role.entity';
import { User } from 'src/users/entities/user.entity';
import { Repository } from 'typeorm';
import { JwtPayloadBuilder } from './builders/jwt-payload.builder';
import { SessionAuditService } from './services/session-audit.service';
import { TokenStoreService } from './services/token-store.service';

@Injectable()
export class AuthService {
	public readonly logger = new Logger(AuthService.name);

	constructor(
		@InjectRepository(User)
		private readonly userRepository: Repository<User>,
		@InjectRepository(Role)
		private readonly roleRepository: Repository<Role>,
		private readonly passwordEncryption: PasswordEncryption,
		private readonly passwordMigration: PasswordMigrationService,
		private readonly DataEncryption: DataEncryptionProvider,
		private readonly jwtService: JwtService,
		private readonly configService: AppConfigService,
		private readonly tokenStore: TokenStoreService,
		private readonly sessionAudit: SessionAuditService,
	) {
		this.logger.log(
			`🔐 Algoritmo de hashing ativo: ${this.passwordEncryption.getAlgorithm()}`,
		);
	}

	async signUp(email: string, password: string, isAdmin = false) {
		const userExist = await this.userRepository.findOneBy({ email });
		if (userExist) {
			this.logger.error('User exists', userExist);
			throw new BadRequestException('User already exists');
		}

		const result = await this.passwordEncryption.encrypt(password);
		const roleName = isAdmin ? 'admin' : 'user';
		const role = await this.roleRepository.findOne({
			where: { name: roleName },
		});
		if (!role) {
			throw new BadRequestException(
				`${roleName.charAt(0).toUpperCase() + roleName.slice(1)} role not found`,
			);
		}
		const user = await this.userRepository.save(
			this.userRepository.create({
				userName: email.split('@')[0],
				email,
				password: result,
				roles: [role],
			}),
		);

		// Carrega as roles explicitamente do objeto recém-salvo para garantir compatibilidade com o frontend e testes
		// sem depender de um novo SELECT no banco de dados que poderia atingir um slave com lag.
		user.roles = [role];

		this.logger.log('User created', user);
		return user;
	}

	async generateTokensForUser(user: User) {
		const tokens = await this.getTokens(user);
		const hashedToken = await this.DataEncryption.encrypt(
			tokens.refreshToken,
		);
		await this.tokenStore.addToken(user.id, {
			hash: hashedToken,
			jti: tokens.refreshTokenId,
			familyId: tokens.refreshTokenFamilyId,
		});
		this.sessionAudit.track(user.id, 'signup_success', {
			refreshTokenId: tokens.refreshTokenId,
			familyId: tokens.refreshTokenFamilyId,
		});
		return {
			accessToken: tokens.accessToken,
			refreshToken: tokens.refreshToken,
		};
	}

	private async getTokens(
		user: User,
		rotation?: { familyId?: string; parentJti?: string },
	): Promise<{
		accessToken: string;
		refreshToken: string;
		refreshTokenId: string;
		refreshTokenFamilyId: string;
	}> {
		if (!user.roles || user.roles.length === 0) {
			throw new BadRequestException('User has no roles assigned');
		}

		const payload = new JwtPayloadBuilder()
			.fromUser(user)
			.setIssuer(this.configService.jwtIssuer)
			.build();

		const refreshTokenId = randomUUID();
		const refreshTokenFamilyId = rotation?.familyId ?? randomUUID();
		const refreshPayload = {
			...payload,
			jti: refreshTokenId,
			familyId: refreshTokenFamilyId,
			parentJti: rotation?.parentJti,
		};

		const [accessToken, refreshToken] = await Promise.all([
			this.jwtService.signAsync(payload, {
				secret: this.configService.jwtAccessSecret,
				expiresIn: this.configService.jwtAccessExpiration,
				audience: this.configService.jwtAudience,
			}),
			this.jwtService.signAsync(refreshPayload, {
				secret: this.configService.jwtRefreshSecret,
				expiresIn: this.configService.jwtRefreshExpiration,
				audience: this.configService.jwtAudience,
			}),
		]);

		return {
			accessToken,
			refreshToken,
			refreshTokenId,
			refreshTokenFamilyId,
		};
	}

	private getRefreshTokenMetadata(refreshToken: string): {
		jti: string | null;
		familyId: string | null;
	} {
		const decoded = this.jwtService.decode(refreshToken);
		if (!decoded || typeof decoded !== 'object') {
			return { jti: null, familyId: null };
		}

		const tokenId = (decoded as { jti?: unknown }).jti;
		const familyId = (decoded as { familyId?: unknown }).familyId;

		return {
			jti:
				typeof tokenId === 'string' && tokenId.length > 0
					? tokenId
					: null,
			familyId:
				typeof familyId === 'string' && familyId.length > 0
					? familyId
					: null,
		};
	}

	async signIn(email: string, password: string) {
		const user = await this.userRepository.findOne({
			where: { email },
			relations: ['roles'],
			select: ['id', 'email', 'password', 'roles'],
		});
		if (!user) {
			this.logger.error('User not exists', email);
			throw new UnauthorizedException('User not exists');
		}

		if (!(await this.passwordEncryption.compare(user.password, password))) {
			this.logger.error('Invalid password', email);
			throw new UnauthorizedException('Invalid password');
		}

		const wasMigrated = await this.passwordMigration.migratePasswordOnLogin(
			user,
			password,
		);
		if (wasMigrated) {
			this.logger.log(
				`🔄 Senha do usuário ${user.email} migrada com sucesso para ${this.passwordEncryption.getAlgorithm()}`,
			);
		}

		const tokens = await this.getTokens(user);
		const hashedToken = await this.DataEncryption.encrypt(
			tokens.refreshToken,
		);
		await this.tokenStore.addToken(user.id, {
			hash: hashedToken,
			jti: tokens.refreshTokenId,
			familyId: tokens.refreshTokenFamilyId,
		});
		this.sessionAudit.track(user.id, 'login_success', {
			refreshTokenId: tokens.refreshTokenId,
			familyId: tokens.refreshTokenFamilyId,
		});
		return {
			accessToken: tokens.accessToken,
			refreshToken: tokens.refreshToken,
		};
	}

	async logout(userId: string, refreshToken: string) {
		if (!refreshToken) {
			throw new UnauthorizedException('Refresh token is required');
		}

		const validTokens = await this.tokenStore.getValidTokens(userId);

		if (validTokens.length === 0) {
			this.logger.warn('No active sessions found for user', { userId });
			throw new UnauthorizedException('No active sessions found');
		}

		const refreshTokenMeta = this.getRefreshTokenMetadata(refreshToken);
		let indexToRemove = -1;

		if (refreshTokenMeta.jti) {
			indexToRemove = validTokens.findIndex(
				(token) => token.jti === refreshTokenMeta.jti,
			);

			if (indexToRemove >= 0) {
				const tokenMatch = await this.DataEncryption.compare(
					validTokens[indexToRemove].hash,
					refreshToken,
				);

				if (!tokenMatch) {
					indexToRemove = -1;
				}
			}
		} else {
			for (let i = 0; i < validTokens.length; i++) {
				if (
					await this.DataEncryption.compare(
						validTokens[i].hash,
						refreshToken,
					)
				) {
					indexToRemove = i;
					break;
				}
			}
		}

		if (indexToRemove === -1) {
			this.logger.error('Token not found in cache', { userId });
			throw new UnauthorizedException('Invalid token');
		}

		validTokens.splice(indexToRemove, 1);
		await this.tokenStore.saveTokens(userId, validTokens);
		this.sessionAudit.track(userId, 'logout_success', {
			remainingSessions: validTokens.length,
		});

		this.logger.log(
			`Token removed for user ${userId}. Remaining tokens: ${validTokens.length}`,
		);

		return { message: 'Logged out successfully' };
	}

	async logoutAll(userId: string) {
		const validTokens = await this.tokenStore.getValidTokens(userId);

		if (validTokens.length === 0) {
			this.logger.warn('No active sessions found for user', { userId });
			throw new UnauthorizedException('No active sessions found');
		}

		await this.tokenStore.removeAllTokens(userId);
		this.sessionAudit.track(userId, 'logout_all_success', {
			revokedSessions: validTokens.length,
		});
		this.logger.log(
			`All sessions (${validTokens.length}) logged out for user ${userId}`,
		);
		return { message: 'All sessions logged out successfully' };
	}

	async refreshTokens(userId: string, oldRefreshToken: string) {
		if (!oldRefreshToken) {
			throw new UnauthorizedException('Refresh token is required');
		}

		return this.tokenStore.runWithRefreshLock(userId, async () => {
			const validTokens = await this.tokenStore.getValidTokens(userId);

			if (validTokens.length === 0) {
				this.logger.warn('No valid session found for user', { userId });
				throw new UnauthorizedException('No valid session found');
			}

			const refreshTokenMeta =
				this.getRefreshTokenMetadata(oldRefreshToken);
			if (!refreshTokenMeta.jti) {
				throw new UnauthorizedException('Invalid refresh token');
			}

			const indexToRemove = validTokens.findIndex(
				(token) => token.jti === refreshTokenMeta.jti,
			);

			if (indexToRemove === -1) {
				this.logger.error('Refresh token reuse detected', {
					userId,
					refreshTokenId: refreshTokenMeta.jti,
					familyId: refreshTokenMeta.familyId,
				});
				this.sessionAudit.track(userId, 'refresh_reuse_detected', {
					refreshTokenId: refreshTokenMeta.jti,
					familyId: refreshTokenMeta.familyId,
				});
				if (refreshTokenMeta.familyId) {
					const revokedCount =
						await this.tokenStore.revokeTokenFamily(
							userId,
							refreshTokenMeta.familyId,
							validTokens,
						);
					this.sessionAudit.track(userId, 'refresh_family_revoked', {
						familyId: refreshTokenMeta.familyId,
						revokedCount,
					});
				} else {
					await this.tokenStore.removeAllTokens(userId);
				}
				throw new UnauthorizedException('Refresh token reuse detected');
			}

			const tokenMatch = await this.DataEncryption.compare(
				validTokens[indexToRemove].hash,
				oldRefreshToken,
			);
			if (!tokenMatch) {
				this.logger.error('Refresh token hash mismatch detected', {
					userId,
					refreshTokenId: refreshTokenMeta.jti,
					familyId: refreshTokenMeta.familyId,
				});
				this.sessionAudit.track(userId, 'refresh_reuse_detected', {
					refreshTokenId: refreshTokenMeta.jti,
					familyId: refreshTokenMeta.familyId,
					reason: 'hash_mismatch',
				});
				if (refreshTokenMeta.familyId) {
					const revokedCount =
						await this.tokenStore.revokeTokenFamily(
							userId,
							refreshTokenMeta.familyId,
							validTokens,
						);
					this.sessionAudit.track(userId, 'refresh_family_revoked', {
						familyId: refreshTokenMeta.familyId,
						revokedCount,
					});
				} else {
					await this.tokenStore.removeAllTokens(userId);
				}
				throw new UnauthorizedException('Refresh token reuse detected');
			}

			const rotatedToken = validTokens[indexToRemove];
			validTokens.splice(indexToRemove, 1);

			const user = await this.userRepository.findOne({
				where: { id: userId },
				relations: ['roles'],
			});

			if (!user) {
				this.logger.error('User not found during token refresh', {
					userId,
				});
				throw new UnauthorizedException('User not found');
			}

			const currentFamilyId =
				rotatedToken?.familyId ??
				refreshTokenMeta.familyId ??
				randomUUID();

			const tokens = await this.getTokens(user, {
				familyId: currentFamilyId,
				parentJti: refreshTokenMeta.jti,
			});

			const hashedToken = await this.DataEncryption.encrypt(
				tokens.refreshToken,
			);

			await this.tokenStore.addToken(
				userId,
				{
					hash: hashedToken,
					jti: tokens.refreshTokenId,
					familyId: tokens.refreshTokenFamilyId,
					parentJti: refreshTokenMeta.jti,
				},
				validTokens,
			);

			this.sessionAudit.track(userId, 'refresh_success', {
				refreshTokenId: tokens.refreshTokenId,
				familyId: tokens.refreshTokenFamilyId,
				parentJti: refreshTokenMeta.jti,
			});

			this.logger.log(
				`Tokens refreshed for user ${userId}. Total tokens: ${validTokens.length}`,
			);
			return {
				accessToken: tokens.accessToken,
				refreshToken: tokens.refreshToken,
			};
		});
	}
}
