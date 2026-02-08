import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AppConfigService } from 'src/app-config/app-config.service';
import { CurrentUserDto } from '../dto/current-user.dto';
import { PayloadAuthDto } from '../dto/payload-auth.dto';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
	constructor(
		private readonly jwtService: JwtService,
		private readonly configService: AppConfigService,
	) {
		super({
			jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
			ignoreExpiration: false,
			secretOrKey: configService.jwtAccessSecret,
		});
	}

	async validate(payload: PayloadAuthDto): Promise<CurrentUserDto> {
		return {
			userId: payload.sub,
			username: payload.email,
			roles: payload.roles,
			maxWeightSensitiveContent: payload.maxWeightSensitiveContent,
		};
	}
}
