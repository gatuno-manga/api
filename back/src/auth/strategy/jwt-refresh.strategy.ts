import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AppConfigService } from 'src/app-config/app-config.service';
import { DataEncryptionProvider } from 'src/encryption/data-encryption.provider';
import { PayloadAuthDto } from '../dto/payload-auth.dto';
import { TokenStoreService } from '../services/token-store.service';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
	Strategy,
	'jwt-refresh',
) {
	private readonly logger = new Logger(JwtRefreshStrategy.name);
	constructor(
		private readonly configService: AppConfigService,
		private readonly DataEncryption: DataEncryptionProvider,
		private readonly tokenStore: TokenStoreService,
	) {
		super({
			jwtFromRequest: ExtractJwt.fromExtractors([
				(req: Request) => {
					const cookies = req?.cookies as Record<
						string,
						string | undefined
					>;
					return cookies?.refreshToken || null;
				},
			]),
			ignoreExpiration: false,
			secretOrKey: configService.jwtRefreshSecret,
			issuer: configService.jwtIssuer,
			audience: configService.jwtAudience,
			passReqToCallback: true,
		});
	}

	async validate(req: Request, payload: PayloadAuthDto) {
		const cookies = req.cookies as Record<string, string | undefined>;
		const refreshToken = cookies?.refreshToken;
		if (!refreshToken) {
			throw new UnauthorizedException('No refresh token cookie');
		}

		if (!payload.jti) {
			throw new UnauthorizedException('Invalid refresh token payload');
		}

		const userId = payload.sub;
		const validTokens = await this.tokenStore.getValidTokens(userId);
		if (validTokens.length === 0) {
			throw new UnauthorizedException(
				'Access Denied. No valid session found.',
			);
		}

		const storedToken = validTokens.find(
			(token) =>
				token.jti === payload.jti &&
				(!payload.familyId || token.familyId === payload.familyId),
		);
		if (!storedToken) {
			this.logger.warn('Refresh token jti not found in active sessions', {
				userId,
				jti: payload.jti,
			});
			throw new UnauthorizedException('Access Denied. Invalid token.');
		}

		const match = await this.DataEncryption.compare(
			storedToken.hash,
			refreshToken,
		);
		if (!match) {
			this.logger.warn('Refresh token hash mismatch', {
				userId,
				jti: payload.jti,
			});
			throw new UnauthorizedException('Access Denied. Invalid token.');
		}
		return { userId: payload.sub, email: payload.email };
	}
}
