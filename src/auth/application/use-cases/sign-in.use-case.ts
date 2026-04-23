import {
	Inject,
	Injectable,
	Logger,
	UnauthorizedException,
} from '@nestjs/common';
import { PasswordEncryption } from 'src/infrastructure/encryption/password-encryption.provider';
import { EmailVO } from '../../domain/value-objects/email.vo';
import {
	UserAuthData,
	UserRepositoryPort,
} from '../ports/user-repository.port';
import { SessionAuditService } from '../../infrastructure/adapters/session-audit.service';
import {
	AuthFlowResult,
	AuthRequestContext,
} from '../../types/auth-security.types';

@Injectable()
export class SignInUseCase {
	private readonly logger = new Logger(SignInUseCase.name);

	constructor(
		@Inject('UserRepositoryPort')
		private readonly userRepository: UserRepositoryPort,
		private readonly passwordEncryption: PasswordEncryption,
		private readonly sessionAudit: SessionAuditService,
	) {}

	async execute(
		emailStr: string,
		password: string,
		context?: AuthRequestContext,
		issueAuthFlow?: (
			user: UserAuthData,
			authMethod: string,
			context?: AuthRequestContext,
		) => Promise<AuthFlowResult>,
	): Promise<AuthFlowResult> {
		const email = new EmailVO(emailStr);
		const user = await this.userRepository.findCredentialsByEmail(email);

		if (!user) {
			this.sessionAudit.track({
				event: 'login_failed',
				success: false,
				context,
				metadata: {
					email: email.value,
					reason: 'user_not_found',
				},
			});
			this.logger.error('User not exists', email.value);
			throw new UnauthorizedException('User not exists');
		}

		if (!user.password) {
			this.sessionAudit.track({
				userId: user.id,
				event: 'login_failed',
				success: false,
				context,
				metadata: {
					reason: 'password_hash_unavailable',
				},
			});
			this.logger.error(
				'Password hash unavailable for sign in',
				email.value,
			);
			throw new UnauthorizedException('Invalid password');
		}

		const isPasswordValid = await this.passwordEncryption.compare(
			user.password,
			password,
		);

		if (!isPasswordValid) {
			this.sessionAudit.track({
				userId: user.id,
				event: 'login_failed',
				success: false,
				context,
				metadata: {
					reason: 'invalid_password',
				},
			});
			this.logger.error('Invalid password', email.value);
			throw new UnauthorizedException('Invalid password');
		}
		if (issueAuthFlow) {
			return issueAuthFlow(user, 'password', context);
		}

		throw new Error('Auth flow issuer not provided');
	}
}
