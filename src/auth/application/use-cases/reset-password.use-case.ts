import { AppConfigService } from '@app-config/app-config.service';
import { UserRepositoryPort } from '@auth/application/ports/user-repository.port';
import { EmailVO } from '@auth/domain/value-objects/email.vo';
import { PlainPasswordVO } from '@auth/domain/value-objects/plain-password.vo';
import { SessionManagementService } from '@auth/infrastructure/adapters/session-management.service';
import {
	Inject,
	Injectable,
	Logger,
	UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PasswordEncryption } from 'src/infrastructure/encryption/password-encryption.provider';

@Injectable()
export class ResetPasswordUseCase {
	private readonly logger = new Logger(ResetPasswordUseCase.name);

	constructor(
		@Inject('UserRepositoryPort')
		private readonly userRepository: UserRepositoryPort,
		private readonly jwtService: JwtService,
		private readonly passwordEncryption: PasswordEncryption,
		private readonly sessionManagement: SessionManagementService,
		private readonly config: AppConfigService,
	) {}

	async execute(
		emailStr: string,
		token: string,
		newPasswordStr: string,
	): Promise<void> {
		const email = new EmailVO(emailStr);
		const user = await this.userRepository.findCredentialsByEmail(email);

		if (!user) {
			throw new UnauthorizedException(
				'Invalid or expired password reset token',
			);
		}

		try {
			this.jwtService.verify(token, {
				secret: this.config.jwt.accessSecret + (user.password || ''),
			});
		} catch (_err) {
			this.logger.warn(
				`Invalid or expired reset token used for ${emailStr}`,
			);
			throw new UnauthorizedException(
				'Invalid or expired password reset token',
			);
		}

		const plainPassword = new PlainPasswordVO(newPasswordStr);
		const newHash = await this.passwordEncryption.encrypt(
			plainPassword.value,
		);

		await this.userRepository.updatePassword(user.id, newHash);
		await this.sessionManagement.revokeAllSessions(user.id);

		this.logger.log(`Password reset successfully for ${emailStr}`);
	}
}
