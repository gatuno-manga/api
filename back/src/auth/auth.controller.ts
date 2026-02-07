import {
	Body,
	Controller,
	Get,
	Logger,
	Post,
	Req,
	Res,
	UseGuards,
	UnauthorizedException,
} from '@nestjs/common';
import {
	ApiTags,
	ApiOperation,
	ApiResponse,
	ApiBearerAuth,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { AppConfigService } from 'src/app-config/app-config.service';
import { SignUpAuthDto } from './dto/signup-auth.dto';
import { SignInAuthDto } from './dto/signin-auth.dto';
import { RefreshTokenGuard } from './guard/jwt-refresh.guard';
import { JwtAuthGuard } from './guard/jwt-auth.guard';
import { CurrentUserDto } from './dto/current-user.dto';
import { CurrentUser } from './decorator/current-user.decorator';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
	private readonly logger = new Logger(AuthController.name);
	constructor(
		private readonly authService: AuthService,
		private readonly configService: AppConfigService,
	) {}

	/**
	 * Sets the refresh token as an httpOnly cookie on the response.
	 * This ensures the cookie is set on the API domain, so the browser
	 * sends it automatically on cross-origin requests with withCredentials.
	 */
	private setRefreshTokenCookie(res: Response, refreshToken: string): void {
		const isSecure = this.configService.apiUrl.startsWith('https');
		res.cookie('refreshToken', refreshToken, {
			httpOnly: true,
			secure: isSecure,
			sameSite: 'lax',
			path: '/api/auth',
			maxAge: this.configService.refreshTokenTtl,
		});
	}

	private clearRefreshTokenCookie(res: Response): void {
		const isSecure = this.configService.apiUrl.startsWith('https');
		res.clearCookie('refreshToken', {
			httpOnly: true,
			secure: isSecure,
			sameSite: 'lax',
			path: '/api/auth',
		});
	}

	@Post('signup')
	@Throttle({ short: { limit: 3, ttl: 60000 } })
	@ApiOperation({
		summary: 'Create a new user account',
		description: 'Register a new user with email and password',
	})
	@ApiResponse({ status: 201, description: 'User successfully created' })
	@ApiResponse({ status: 400, description: 'Invalid input data' })
	@ApiResponse({ status: 409, description: 'Email already exists' })
	@ApiResponse({ status: 429, description: 'Too many requests' })
	async signUp(@Body() body: SignUpAuthDto) {
		const { email, password } = body;
		const user = await this.authService.signUp(email, password);

		if (!user) {
			throw new UnauthorizedException('Failed to create user');
		}

		const result = {
			id: user.id,
			email: user.email,
			roles: user.roles,
		};

		return result;
	}

	@Post('signin')
	@Throttle({ short: { limit: 5, ttl: 60000 } })
	@ApiOperation({
		summary: 'Sign in to user account',
		description: 'Authenticate user and receive access tokens',
	})
	@ApiResponse({ status: 200, description: 'Successfully authenticated' })
	@ApiResponse({ status: 401, description: 'Invalid credentials' })
	@ApiResponse({ status: 429, description: 'Too many requests' })
	async signIn(
		@Body() body: SignInAuthDto,
		@Res({ passthrough: true }) res: Response,
	) {
		const { email, password } = body;
		const tokens = await this.authService.signIn(email, password);
		this.setRefreshTokenCookie(res, tokens.refreshToken);
		return tokens;
	}

	@Get('refresh')
	@Throttle({ medium: { limit: 20, ttl: 60000 } })
	@ApiOperation({
		summary: 'Refresh access token',
		description: 'Get a new access token using refresh token',
	})
	@ApiResponse({ status: 200, description: 'Token refreshed successfully' })
	@ApiResponse({
		status: 401,
		description: 'Invalid or expired refresh token',
	})
	@ApiResponse({ status: 429, description: 'Too many requests' })
	@ApiBearerAuth('JWT-auth')
	@UseGuards(RefreshTokenGuard)
	async refreshTokens(
		@CurrentUser() user: CurrentUserDto,
		@Req() req,
		@Res({ passthrough: true }) res: Response,
	) {
		const refreshToken = req.cookies?.refreshToken;
		if (!refreshToken) {
			throw new UnauthorizedException(
				'Refresh token not found in cookies',
			);
		}
		const tokens = await this.authService.refreshTokens(
			user.userId,
			refreshToken,
		);
		this.setRefreshTokenCookie(res, tokens.refreshToken);
		return tokens;
	}

	@Get('logout')
	@Throttle({ medium: { limit: 10, ttl: 60000 } })
	@ApiOperation({
		summary: 'Logout from current session',
		description: 'Invalidate the current refresh token',
	})
	@ApiResponse({ status: 200, description: 'Successfully logged out' })
	@ApiResponse({ status: 401, description: 'Unauthorized' })
	@ApiResponse({ status: 429, description: 'Too many requests' })
	@ApiBearerAuth('JWT-auth')
	@UseGuards(RefreshTokenGuard)
	@UseGuards(JwtAuthGuard)
	async logout(
		@CurrentUser() user: CurrentUserDto,
		@Req() req,
		@Res({ passthrough: true }) res: Response,
	) {
		this.logger.log(`User ${user.userId} is logging out`);
		const refreshToken = req.cookies?.refreshToken;
		await this.authService.logout(user.userId, refreshToken);
		this.clearRefreshTokenCookie(res);
		return { message: 'Logged out successfully' };
	}

	@Get('logout-all')
	@Throttle({ medium: { limit: 5, ttl: 60000 } })
	@ApiOperation({
		summary: 'Logout from all sessions',
		description: 'Invalidate all refresh tokens for the user',
	})
	@ApiResponse({
		status: 200,
		description: 'Successfully logged out from all sessions',
	})
	@ApiResponse({ status: 401, description: 'Unauthorized' })
	@ApiResponse({ status: 429, description: 'Too many requests' })
	@ApiBearerAuth('JWT-auth')
	@UseGuards(JwtAuthGuard)
	async logoutAll(
		@CurrentUser() user: CurrentUserDto,
		@Res({ passthrough: true }) res: Response,
	) {
		const result = await this.authService.logoutAll(user.userId);
		this.clearRefreshTokenCookie(res);
		return result;
	}
}
