import { AppConfigService } from '@app-config/app-config.service';
import {
	IEmailServicePort,
	I_EMAIL_SERVICE,
} from '@auth/application/ports/email-service.port';
import { UserRepositoryPort } from '@auth/application/ports/user-repository.port';
import { EmailVO } from '@auth/domain/value-objects/email.vo';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class ForgotPasswordUseCase {
	private readonly logger = new Logger(ForgotPasswordUseCase.name);

	constructor(
		@Inject('UserRepositoryPort')
		private readonly userRepository: UserRepositoryPort,
		@Inject(I_EMAIL_SERVICE)
		private readonly emailService: IEmailServicePort,
		private readonly jwtService: JwtService,
		private readonly config: AppConfigService,
	) {}

	async execute(emailStr: string): Promise<void> {
		try {
			const email = new EmailVO(emailStr);
			const user =
				await this.userRepository.findCredentialsByEmail(email);

			if (!user) {
				this.logger.warn(
					`Password reset requested for non-existent email: ${emailStr}`,
				);
				return; // Do not leak user existence
			}

			const payload = { sub: user.id, purpose: 'password_reset' };
			const token = this.jwtService.sign(payload, {
				secret: this.config.jwt.accessSecret + (user.password || ''),
				expiresIn: '15m',
			});

			const resetLink = `${this.config.appUrl}/reset-password?token=${token}&email=${encodeURIComponent(emailStr)}`;

			await this.emailService.sendPasswordResetEmail(
				email.value,
				resetLink,
			);
		} catch (error) {
			this.logger.error(
				`Error in forgot password for ${emailStr}`,
				error,
			);
		}
	}
}
