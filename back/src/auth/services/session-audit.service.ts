import { Injectable } from '@nestjs/common';
import { CustomLogger } from 'src/custom.logger';

export type SessionAuditEvent =
	| 'login_success'
	| 'signup_success'
	| 'refresh_success'
	| 'refresh_reuse_detected'
	| 'refresh_family_revoked'
	| 'logout_success'
	| 'logout_all_success';

@Injectable()
export class SessionAuditService {
	constructor(private readonly logger: CustomLogger) {
		this.logger.setContext(SessionAuditService.name);
	}

	track(
		userId: string,
		event: SessionAuditEvent,
		metadata?: Record<string, unknown>,
	): void {
		this.logger.logUserAction({
			userId,
			action: `session.${event}`,
			metadata,
		});
	}
}
