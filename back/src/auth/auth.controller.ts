import {
	Body,
	Controller,
	Get,
	Logger,
	Post,
	Req,
	Res,
	UnauthorizedException,
	UseGuards,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import {
	ApiBearerAuth,
	ApiOperation,
	ApiResponse,
	ApiTags,
} from '@nestjs/swagger';
import { SWAGGER_AUTH_SCHEME } from 'src/common/swagger/swagger-auth.constants';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { AppConfigService } from 'src/app-config/app-config.service';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorator/current-user.decorator';
import { CurrentUserDto } from './dto/current-user.dto';
import { SignInAuthDto } from './dto/signin-auth.dto';
import { SignUpAuthDto } from './dto/signup-auth.dto';
import { JwtAuthGuard } from './guard/jwt-auth.guard';
import { RefreshTokenGuard } from './guard/jwt-refresh.guard';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
	private readonly logger = new Logger(AuthController.name);
	private readonly csrfCookieName = 'csrfToken';
	private readonly csrfHeaderName = 'x-csrf-token';
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

	private generateCsrfToken(): string {
		return randomBytes(32).toString('hex');
	}

	private setCsrfCookie(res: Response, csrfToken: string): void {
		const isSecure = this.configService.apiUrl.startsWith('https');
		res.cookie(this.csrfCookieName, csrfToken, {
			httpOnly: false,
			secure: isSecure,
			sameSite: 'lax',
			path: '/',
			maxAge: this.configService.refreshTokenTtl,
		});
	}

	private clearCsrfCookie(res: Response): void {
		const isSecure = this.configService.apiUrl.startsWith('https');
		res.clearCookie(this.csrfCookieName, {
			httpOnly: false,
			secure: isSecure,
			sameSite: 'lax',
			path: '/',
		});
	}

	private validateCsrfForWeb(req: Request): void {
		if (this.isMobileClient(req)) {
			return;
		}

		const cookies = req.cookies as Record<string, string | undefined>;
		const csrfCookie = cookies?.[this.csrfCookieName];
		const csrfHeader = req.header(this.csrfHeaderName);

		if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
			throw new UnauthorizedException('Invalid CSRF token');
		}
	}

	private isMobileClient(req: Request): boolean {
		const clientPlatform = req
			.header('x-client-platform')
			?.toLowerCase()
			.trim();

		return ['mobile', 'flutter', 'app', 'native'].includes(
			clientPlatform ?? '',
		);
	}

	private buildAuthResponse(
		req: Request,
		tokens: { accessToken: string; refreshToken: string },
	): { accessToken: string; refreshToken?: string } {
		if (this.isMobileClient(req)) {
			return tokens;
		}

		return { accessToken: tokens.accessToken };
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
	async signUp(
		@Body() body: SignUpAuthDto,
		@Req() req: Request,
		@Res({ passthrough: true }) res: Response,
	) {
		const { email, password } = body;
		const user = await this.authService.signUp(email, password);

		if (!user) {
			throw new UnauthorizedException('Failed to create user');
		}

		const tokens = await this.authService.generateTokensForUser(user);
		this.setRefreshTokenCookie(res, tokens.refreshToken);
		this.setCsrfCookie(res, this.generateCsrfToken());

		return this.buildAuthResponse(req, tokens);
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
		@Req() req: Request,
		@Res({ passthrough: true }) res: Response,
	) {
		const { email, password } = body;
		const tokens = await this.authService.signIn(email, password);
		this.setRefreshTokenCookie(res, tokens.refreshToken);
		this.setCsrfCookie(res, this.generateCsrfToken());
		return this.buildAuthResponse(req, tokens);
	}

	@Post('refresh')
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
	@ApiBearerAuth(SWAGGER_AUTH_SCHEME)
	@UseGuards(RefreshTokenGuard)
	async refreshTokens(
		@CurrentUser() user: CurrentUserDto,
		@Req() req: Request,
		@Res({ passthrough: true }) res: Response,
	) {
		this.validateCsrfForWeb(req);
		const refreshToken = (req.cookies as Record<string, string | undefined>)
			?.refreshToken;
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
		this.setCsrfCookie(res, this.generateCsrfToken());
		return this.buildAuthResponse(req, tokens);
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
	@ApiBearerAuth(SWAGGER_AUTH_SCHEME)
	@UseGuards(RefreshTokenGuard)
	@UseGuards(JwtAuthGuard)
	async logout(
		@CurrentUser() user: CurrentUserDto,
		@Req() req: Request,
		@Res({ passthrough: true }) res: Response,
	) {
		this.validateCsrfForWeb(req);
		this.logger.log(`User ${user.userId} is logging out`);
		const refreshToken = (req.cookies as Record<string, string | undefined>)
			?.refreshToken;
		if (!refreshToken) {
			throw new UnauthorizedException(
				'Refresh token not found in cookies',
			);
		}
		await this.authService.logout(user.userId, refreshToken);
		this.clearRefreshTokenCookie(res);
		this.clearCsrfCookie(res);
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
	@ApiBearerAuth(SWAGGER_AUTH_SCHEME)
	@UseGuards(JwtAuthGuard)
	async logoutAll(
		@CurrentUser() user: CurrentUserDto,
		@Res({ passthrough: true }) res: Response,
	) {
		const result = await this.authService.logoutAll(user.userId);
		this.clearRefreshTokenCookie(res);
		this.clearCsrfCookie(res);
		return result;
	}
}
