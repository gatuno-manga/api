import { JwtService } from '@nestjs/jwt';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AppConfigService } from 'src/app-config/app-config.service';
import { PayloadAuthDto } from '../dto/payload-auth.dto';
import { Injectable } from '@nestjs/common';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
	constructor(
		private readonly jwtService: JwtService,
		private readonly configService: AppConfigService,
	) {
		super({
			jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
			ignoreExpiration: false,
			secretOrKey: configService.JwtAccessSecret,
		});
	}

	async validate(payload: PayloadAuthDto) {
		return { userId: payload.sub, username: payload.email };
	}
}
