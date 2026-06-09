import { OAuthLoginUseCase } from '@auth/application/use-cases/oauth-login.use-case';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { Profile, Strategy } from 'passport-github2';
import { AppConfigService } from 'src/infrastructure/app-config/app-config.service';

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
	constructor(
		private readonly configService: AppConfigService,
		private readonly oauthLoginUseCase: OAuthLoginUseCase,
		private readonly jwtService: JwtService,
	) {
		const config = configService.oauth.github;
		super({
			clientID: config.clientId || 'disabled',
			clientSecret: config.clientSecret || 'disabled',
			callbackURL: config.callbackUrl,
			scope: ['user:email'],
			passReqToCallback: true,
		});
	}

	async validate(
		req: Request,
		accessToken: string,
		refreshToken: string,
		profile: Profile,
	) {
		const { id, emails, displayName, username } = profile;
		if (!emails || !emails[0]?.value) {
			throw new UnauthorizedException(
				'GitHub account does not have an email',
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
			'github',
			id,
			emails[0].value,
			displayName || username,
			existingUserId,
		);
	}
}
