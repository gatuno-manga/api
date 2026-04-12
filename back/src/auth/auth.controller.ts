import {
	Body,
	Controller,
	Delete,
	Get,
	Logger,
	NotFoundException,
	Param,
	Post,
	Query,
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
import { BeginPasskeyAuthDto } from './dto/begin-passkey-auth.dto';
import { CurrentUserDto } from './dto/current-user.dto';
import { ListAuthAuditQueryDto } from './dto/list-auth-audit-query.dto';
import { RevokeSessionDto } from './dto/revoke-session.dto';
import { SignInAuthDto } from './dto/signin-auth.dto';
import { SignUpAuthDto } from './dto/signup-auth.dto';
import { VerifyMfaLoginDto } from './dto/verify-mfa-login.dto';
import { VerifyPasskeyAuthDto } from './dto/verify-passkey-auth.dto';
import { VerifyPasskeyRegistrationDto } from './dto/verify-passkey-registration.dto';
import { VerifyTotpCodeDto } from './dto/verify-totp-code.dto';
import { JwtAuthGuard } from './guard/jwt-auth.guard';
import { RefreshTokenGuard } from './guard/jwt-refresh.guard';
import { WebauthnService } from './services/webauthn.service';
import {
	AuthRequestContext,
	isPendingMfaResult,
	SuccessfulAuthResult,
} from './types/auth-security.types';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
	private readonly logger = new Logger(AuthController.name);
	private readonly csrfCookieName = 'csrfToken';
	private readonly csrfHeaderName = 'x-csrf-token';

	constructor(
		private readonly authService: AuthService,
		private readonly webauthnService: WebauthnService,
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
			this.logger.warn(
				`CSRF validation failed for web auth request (cookie=${Boolean(csrfCookie)}, header=${Boolean(csrfHeader)})`,
			);
			throw new UnauthorizedException('Invalid CSRF token');
		}
	}

	private isMobileClient(req: Request): boolean {
		const clientPlatform = req
			.header('x-client-platform')
			?.toLowerCase()
			.trim();

		if (clientPlatform === undefined || clientPlatform === '') return false;

		return ['mobile', 'flutter', 'app', 'native'].includes(clientPlatform);
	}

	private buildRequestContext(req: Request): AuthRequestContext {
		const xForwardedFor = req.header('x-forwarded-for');
		const forwardedIp = xForwardedFor
			?.split(',')
			.map((item) => item.trim())[0];
		const ipAddress =
			forwardedIp || req.ip || req.socket.remoteAddress || null;

		return {
			ipAddress,
			userAgent: req.header('user-agent') ?? null,
			clientPlatform: req.header('x-client-platform') ?? 'web',
			deviceId: req.header('x-device-id') ?? null,
			deviceLabel: req.header('x-device-name') ?? null,
		};
	}

	private buildAuthResponse(
		req: Request,
		tokens: SuccessfulAuthResult,
	): { accessToken: string; refreshToken?: string; sessionId: string } {
		if (this.isMobileClient(req)) {
			return tokens;
		}

		return {
			accessToken: tokens.accessToken,
			sessionId: tokens.sessionId,
		};
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

		const tokens = await this.authService.generateTokensForUser(user, {
			authMethod: 'password',
			context: this.buildRequestContext(req),
			mfaVerified: false,
			riskLevel: 'low',
			auditEvent: 'signup_success',
		});

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
		const result = await this.authService.signIn(
			email,
			password,
			this.buildRequestContext(req),
		);

		if (isPendingMfaResult(result)) {
			this.clearRefreshTokenCookie(res);
			this.clearCsrfCookie(res);
			return result;
		}

		this.setRefreshTokenCookie(res, result.refreshToken);
		this.setCsrfCookie(res, this.generateCsrfToken());
		return this.buildAuthResponse(req, result);
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
			this.logger.warn(
				'Refresh endpoint called without refresh token cookie',
			);
			throw new UnauthorizedException(
				'Refresh token not found in cookies',
			);
		}
		const tokens = await this.authService.refreshTokens(
			user.userId,
			refreshToken,
			this.buildRequestContext(req),
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
			this.logger.warn(
				'Logout endpoint called without refresh token cookie',
			);
			throw new UnauthorizedException(
				'Refresh token not found in cookies',
			);
		}
		await this.authService.logout(
			user.userId,
			refreshToken,
			this.buildRequestContext(req),
		);
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
		@Req() req: Request,
		@Res({ passthrough: true }) res: Response,
	) {
		const result = await this.authService.logoutAll(
			user.userId,
			this.buildRequestContext(req),
		);
		this.clearRefreshTokenCookie(res);
		this.clearCsrfCookie(res);
		return result;
	}

	@Get('mfa/status')
	@ApiBearerAuth(SWAGGER_AUTH_SCHEME)
	@UseGuards(JwtAuthGuard)
	async getMfaStatus(@CurrentUser() user: CurrentUserDto) {
		return this.authService.getMfaStatus(user.userId);
	}

	@Post('mfa/totp/setup')
	@ApiBearerAuth(SWAGGER_AUTH_SCHEME)
	@UseGuards(JwtAuthGuard)
	async beginTotpSetup(
		@CurrentUser() user: CurrentUserDto,
		@Req() req: Request,
	) {
		return this.authService.beginTotpSetup(
			user.userId,
			this.buildRequestContext(req),
		);
	}

	@Post('mfa/totp/verify-setup')
	@ApiBearerAuth(SWAGGER_AUTH_SCHEME)
	@UseGuards(JwtAuthGuard)
	async verifyTotpSetup(
		@CurrentUser() user: CurrentUserDto,
		@Body() body: VerifyTotpCodeDto,
		@Req() req: Request,
	) {
		return this.authService.verifyTotpSetup(
			user.userId,
			body.code,
			this.buildRequestContext(req),
		);
	}

	@Post('mfa/totp/disable')
	@ApiBearerAuth(SWAGGER_AUTH_SCHEME)
	@UseGuards(JwtAuthGuard)
	async disableTotp(
		@CurrentUser() user: CurrentUserDto,
		@Body() body: VerifyTotpCodeDto,
		@Req() req: Request,
	) {
		return this.authService.disableTotp(
			user.userId,
			body.code,
			this.buildRequestContext(req),
		);
	}

	@Post('mfa/verify-login')
	@Throttle({ short: { limit: 10, ttl: 60000 } })
	async verifyMfaLogin(
		@Body() body: VerifyMfaLoginDto,
		@Req() req: Request,
		@Res({ passthrough: true }) res: Response,
	) {
		const result = await this.authService.verifyMfaAndCompleteSignIn(
			body.mfaToken,
			body.code,
		);
		this.setRefreshTokenCookie(res, result.refreshToken);
		this.setCsrfCookie(res, this.generateCsrfToken());
		return this.buildAuthResponse(req, result);
	}

	@Post('passkeys/authenticate/options')
	@Throttle({ short: { limit: 10, ttl: 60000 } })
	async beginPasskeyAuthentication(@Body() body: BeginPasskeyAuthDto) {
		return this.webauthnService.beginAuthentication(body.email);
	}

	@Post('passkeys/authenticate/verify')
	@Throttle({ short: { limit: 10, ttl: 60000 } })
	async verifyPasskeyAuthentication(
		@Body() body: VerifyPasskeyAuthDto,
		@Req() req: Request,
		@Res({ passthrough: true }) res: Response,
	) {
		const user = await this.webauthnService.verifyAuthentication(
			body.email,
			body.response,
		);

		const result = await this.authService.completePasskeySignIn(
			user,
			this.buildRequestContext(req),
		);

		if (isPendingMfaResult(result)) {
			return result;
		}

		this.setRefreshTokenCookie(res, result.refreshToken);
		this.setCsrfCookie(res, this.generateCsrfToken());
		return this.buildAuthResponse(req, result);
	}

	@Get('passkeys')
	@ApiBearerAuth(SWAGGER_AUTH_SCHEME)
	@UseGuards(JwtAuthGuard)
	async listPasskeys(@CurrentUser() user: CurrentUserDto) {
		return this.webauthnService.listUserPasskeys(user.userId);
	}

	@Post('passkeys/register/options')
	@ApiBearerAuth(SWAGGER_AUTH_SCHEME)
	@UseGuards(JwtAuthGuard)
	async beginPasskeyRegistration(@CurrentUser() user: CurrentUserDto) {
		return this.webauthnService.beginRegistration(user.userId);
	}

	@Post('passkeys/register/verify')
	@ApiBearerAuth(SWAGGER_AUTH_SCHEME)
	@UseGuards(JwtAuthGuard)
	async verifyPasskeyRegistration(
		@CurrentUser() user: CurrentUserDto,
		@Body() body: VerifyPasskeyRegistrationDto,
	) {
		return this.webauthnService.verifyRegistration(
			user.userId,
			body.response,
			body.name,
		);
	}

	@Delete('passkeys/:passkeyId')
	@ApiBearerAuth(SWAGGER_AUTH_SCHEME)
	@UseGuards(JwtAuthGuard)
	async deletePasskey(
		@CurrentUser() user: CurrentUserDto,
		@Param('passkeyId') passkeyId: string,
	) {
		const deleted = await this.webauthnService.deleteUserPasskey(
			user.userId,
			passkeyId,
		);
		if (!deleted) {
			throw new NotFoundException('Passkey not found');
		}
		return { message: 'Passkey removed successfully' };
	}

	@Get('sessions')
	@ApiBearerAuth(SWAGGER_AUTH_SCHEME)
	@UseGuards(JwtAuthGuard)
	async listSessions(@CurrentUser() user: CurrentUserDto) {
		return this.authService.listActiveSessions(user.userId, user.sessionId);
	}

	@Delete('sessions/others')
	@ApiBearerAuth(SWAGGER_AUTH_SCHEME)
	@UseGuards(JwtAuthGuard)
	async revokeOtherSessions(
		@CurrentUser() user: CurrentUserDto,
		@Req() req: Request,
	) {
		return this.authService.revokeOtherSessions(
			user.userId,
			user.sessionId,
			this.buildRequestContext(req),
		);
	}

	@Delete('sessions/:sessionId')
	@ApiBearerAuth(SWAGGER_AUTH_SCHEME)
	@UseGuards(JwtAuthGuard)
	async revokeSession(
		@CurrentUser() user: CurrentUserDto,
		@Param('sessionId') sessionId: string,
		@Body() body: RevokeSessionDto,
		@Req() req: Request,
	) {
		return this.authService.revokeSession(
			user.userId,
			sessionId,
			body.reason,
			this.buildRequestContext(req),
		);
	}

	@Get('audit-history')
	@ApiBearerAuth(SWAGGER_AUTH_SCHEME)
	@UseGuards(JwtAuthGuard)
	async getAuditHistory(
		@CurrentUser() user: CurrentUserDto,
		@Query() query: ListAuthAuditQueryDto,
	) {
		return this.authService.getAuditHistory(user.userId, query);
	}
}
