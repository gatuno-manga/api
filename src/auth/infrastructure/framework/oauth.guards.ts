import {
	ExecutionContext,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AppConfigService } from 'src/infrastructure/app-config/app-config.service';

@Injectable()
export class GoogleOauthGuard extends AuthGuard('google') {
	constructor(private configService: AppConfigService) {
		super();
	}
	canActivate(context: ExecutionContext) {
		if (!this.configService.oauth.google.clientId) {
			throw new NotFoundException(
				'Google Login is not configured on this server.',
			);
		}
		return super.canActivate(context);
	}
}

@Injectable()
export class DiscordOauthGuard extends AuthGuard('discord') {
	constructor(private configService: AppConfigService) {
		super();
	}
	canActivate(context: ExecutionContext) {
		if (!this.configService.oauth.discord.clientId) {
			throw new NotFoundException(
				'Discord Login is not configured on this server.',
			);
		}
		return super.canActivate(context);
	}
}

@Injectable()
export class GithubOauthGuard extends AuthGuard('github') {
	constructor(private configService: AppConfigService) {
		super();
	}
	canActivate(context: ExecutionContext) {
		if (!this.configService.oauth.github.clientId) {
			throw new NotFoundException(
				'GitHub Login is not configured on this server.',
			);
		}
		return super.canActivate(context);
	}
}
