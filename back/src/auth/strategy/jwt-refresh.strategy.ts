import { Inject, Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { AppConfigService } from "src/app-config/app-config.service";
import { PayloadAuthDto } from "../dto/payload-auth.dto";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Request } from 'express';
import { DataEncryptionProvider } from "src/encryption/data-encryption.provider";
import { Cache } from 'cache-manager';
import { StoredTokenDto } from "../dto/stored-token.dto";


@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
    Strategy,
    'jwt-refresh',
) {
    private readonly logger = new Logger(JwtRefreshStrategy.name);
    constructor(
        private readonly jwtService: JwtService,
        private readonly configService: AppConfigService,
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
        private readonly DataEncryption: DataEncryptionProvider
    ) {
        super({
            jwtFromRequest: ExtractJwt.fromExtractors([
                (req: Request) => req?.cookies?.refreshToken || null,
            ]),
            ignoreExpiration: false,
            secretOrKey: configService.jwtRefreshSecret,
            passReqToCallback: true,
        });
    }

    async validate(req: Request, payload: PayloadAuthDto) {
        const refreshToken = req.cookies?.refreshToken;
        if (!refreshToken) {
            throw new UnauthorizedException('No refresh token cookie');
        }
        const userId = payload.sub;
        const key = `user-tokens:${userId}`;
        const storedTokens: StoredTokenDto[] = await this.cacheManager.get(key) || [];

        const validTokens = storedTokens.filter(t => t.expiresAt > Date.now()); if (validTokens.length === 0) {
            throw new UnauthorizedException('Access Denied. No valid session found.');
        }

        let match = false;
        for (const storedToken of validTokens) {
            if (await this.DataEncryption.compare(storedToken.hash, refreshToken)) {
                match = true;
                break;
            }
        }

        if (!match) {
            throw new UnauthorizedException('Access Denied. Invalid token.');
        }
        return { userId: payload.sub, email: payload.email };
    }
}
