import { Body, Controller, Get, Inject, Logger, Post, Req, Res, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignUpAuthDto } from './dto/signup-auth.dto';
import { SignInAuthDto } from './dto/signin-auth.dto';
import { RefreshTokenGuard } from './guard/jwt-refresh.guard';
import { JwtAuthGuard } from './guard/jwt-auth.guard';
import { CurrentUserDto } from './dto/current-user.dto';
import { CurrentUser } from './decorator/current-user.decorator';

@Controller('auth')
export class AuthController {
    constructor(
        private readonly authService: AuthService,
    ) {}

    @Post('signup')
    async signUp(@Body() body: SignUpAuthDto) {
        const { email, password } = body;
        const user = await this.authService.signUp(email, password);

        const result = {
            id: user.id,
            email: user.email,
            roles: user.roles
        };

        return result;
    }

    @Post('signin')
    async signIn(@Body() body: SignInAuthDto) {
        const { email, password } = body;
        const tokens = await this.authService.signIn(email, password)
        return tokens;
    }

    @Get('refresh')
    @UseGuards(RefreshTokenGuard)
    refreshTokens(@CurrentUser() user: CurrentUserDto, @Req() req) {
        const refreshToken = req.cookies?.refreshToken;
        return this.authService.refreshTokens(user.userId, refreshToken);
    }
}
