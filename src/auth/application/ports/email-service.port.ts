export interface IEmailServicePort {
	sendPasswordResetEmail(email: string, resetLink: string): Promise<void>;
}

export const I_EMAIL_SERVICE = 'IEmailServicePort';
