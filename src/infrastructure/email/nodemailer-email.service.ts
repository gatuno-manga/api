import { AppConfigService } from '@app-config/app-config.service';
import { IEmailServicePort } from '@auth/application/ports/email-service.port';
import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class NodemailerEmailService implements IEmailServicePort {
	private readonly logger = new Logger(NodemailerEmailService.name);
	private transporter: nodemailer.Transporter | null = null;

	constructor(private readonly config: AppConfigService) {
		this.initTransporter();
	}

	private initTransporter() {
		const smtpConfig = this.config.smtp;
		if (!smtpConfig.host) {
			this.logger.warn(
				'SMTP_HOST not configured. Emails will be logged to console instead of sent.',
			);
			return;
		}

		this.transporter = nodemailer.createTransport({
			host: smtpConfig.host,
			port: smtpConfig.port,
			secure: smtpConfig.secure,
			auth: smtpConfig.user
				? {
						user: smtpConfig.user,
						pass: smtpConfig.pass,
					}
				: undefined,
		});
	}

	async sendPasswordResetEmail(
		email: string,
		resetLink: string,
	): Promise<void> {
		if (!this.transporter) {
			this.logger.warn(`
======================================================
[SMTP NOT CONFIGURED] Password Reset Requested
User: ${email}
Recovery Link: ${resetLink}
Please share this link with the user or configure SMTP_HOST.
======================================================`);
			return;
		}

		try {
			await this.transporter.sendMail({
				from: this.config.smtp.from,
				to: email,
				subject: 'Password Reset Request - Gatuno',
				text: `You requested a password reset. Please click the link below to reset your password:\n\n${resetLink}\n\nIf you did not request this, please ignore this email.`,
				html: `
					<h2>Password Reset</h2>
					<p>You requested a password reset. Please click the link below to reset your password:</p>
					<p><a href="${resetLink}">${resetLink}</a></p>
					<p>If you did not request this, please ignore this email.</p>
				`,
			});
			this.logger.log(`Password reset email sent to ${email}`);
		} catch (error) {
			this.logger.error(
				`Failed to send password reset email to ${email}`,
				error,
			);
			// Fallback to console log so the user isn't locked out completely if SMTP fails
			this.logger.warn(`Fallback recovery link: ${resetLink}`);
		}
	}
}
