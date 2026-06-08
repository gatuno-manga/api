import { OAuthLoginUseCase } from '@auth/application/use-cases/oauth-login.use-case';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { Profile, Strategy } from 'passport-google-oauth20';
import { AppConfigService } from 'src/infrastructure/app-config/app-config.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
	constructor(
		private readonly configService: AppConfigService,
		private readonly oauthLoginUseCase: OAuthLoginUseCase,
		private readonly jwtService: JwtService,
	) {
		const config = configService.oauth.google;
		super({
			clientID: config.clientId || 'disabled',
			clientSecret: config.clientSecret || 'disabled',
			callbackURL: config.callbackUrl,
			scope: ['email', 'profile'],
			passReqToCallback: true,
		});
	}

	async validate(
		req: Request,
		accessToken: string,
		refreshToken: string,
		profile: Profile,
	) {
		const { id, emails, displayName } = profile;
		if (!emails || !emails[0]?.value) {
			throw new UnauthorizedException(
				'Google account does not have an email',
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
			'google',
			id,
			emails[0].value,
			displayName,
			existingUserId,
		);
	}
}
