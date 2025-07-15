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
    private readonly logger = new Logger(AuthController.name);
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

    @Get('logout')
    @UseGuards(RefreshTokenGuard)
    @UseGuards(JwtAuthGuard)
    async logout(
        @CurrentUser() user: CurrentUserDto,
        @Req() req,
    ) {
        this.logger.log(`User ${user.userId} is logging out`);
        const refreshToken = req.cookies?.refreshToken;
        await this.authService.logout(user.userId, refreshToken);
        return { message: 'Logged out successfully' };
    }

    @Get('logout-all')
    @UseGuards(JwtAuthGuard)
    async logoutAll(
        @CurrentUser() user: CurrentUserDto,
    ) {
        return await this.authService.logoutAll(user.userId);
    }
}
