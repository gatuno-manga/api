import { OAuthLoginUseCase } from '@auth/application/use-cases/oauth-login.use-case';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { Profile, Strategy } from 'passport-discord';
import { AppConfigService } from 'src/infrastructure/app-config/app-config.service';

@Injectable()
export class DiscordStrategy extends PassportStrategy(Strategy, 'discord') {
	constructor(
		private readonly configService: AppConfigService,
		private readonly oauthLoginUseCase: OAuthLoginUseCase,
		private readonly jwtService: JwtService,
	) {
		const config = configService.oauth.discord;
		super({
			clientID: config.clientId || 'disabled',
			clientSecret: config.clientSecret || 'disabled',
			callbackURL: config.callbackUrl,
			scope: ['identify', 'email'],
			passReqToCallback: true,
		});
	}

	async validate(
		req: Request,
		accessToken: string,
		refreshToken: string,
		profile: Profile,
	) {
		const { id, email, username } = profile;
		if (!email) {
			throw new UnauthorizedException(
				'Discord account does not have an email',
			);
		}

		let existingUserId: string | undefined;
		const rToken = req.cookies?.refreshToken;
		if (rToken) {
			try {
				const decoded = this.jwtService.verify(rToken, {
					secret: this.configService.jwt.refreshSecret,
				});
				existingUserId = decoded.sub;
			} catch {}
		}

		return this.oauthLoginUseCase.execute(
			'discord',
			id,
			email,
			username,
			existingUserId,
		);
	}
}
