import { CurrentUserDto } from '@auth/application/dto/current-user.dto';
import { PayloadAuthDto } from '@auth/application/dto/payload-auth.dto';
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AppConfigService } from 'src/infrastructure/app-config/app-config.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
	constructor(
		readonly _jwtService: JwtService,
		readonly configService: AppConfigService,
	) {
		super({
			jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
			ignoreExpiration: false,
			secretOrKey: configService.jwt.accessSecret,
			issuer: configService.jwt.issuer,
			audience: configService.jwt.audience,
		});
	}

	validate(payload: PayloadAuthDto): CurrentUserDto {
		return {
			userId: payload.sub,
			username: payload.email,
			roles: payload.roles,
			maxWeightSensitiveContent: payload.maxWeightSensitiveContent,
			sessionId: payload.sessionId,
		};
	}
}
