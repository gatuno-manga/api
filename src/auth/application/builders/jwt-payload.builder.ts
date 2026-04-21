import { User } from 'src/users/entities/user.entity';
import { UserAuthData } from '../ports/user-repository.port';
import { JwtPayloadDto } from '../dto/jwt-payload.dto';

export class JwtPayloadBuilder {
	private payload: Partial<JwtPayloadDto> = {};

	setSubject(sub: string): this {
		this.payload.sub = sub;
		return this;
	}

	setIssuer(iss: string): this {
		this.payload.iss = iss;
		return this;
	}

	setEmail(email: string): this {
		this.payload.email = email;
		return this;
	}

	setRoles(roles: string[]): this {
		this.payload.roles = roles;
		return this;
	}

	setMaxWeightSensitiveContent(weight: number): this {
		this.payload.maxWeightSensitiveContent = weight;
		return this;
	}

	setIssuedAt(iat: number): this {
		this.payload.iat = iat;
		return this;
	}

	setExpiresAt(exp: number): this {
		this.payload.exp = exp;
		return this;
	}

	setTokenId(jti: string): this {
		this.payload.jti = jti;
		return this;
	}

	setSessionId(sessionId: string): this {
		this.payload.sessionId = sessionId;
		return this;
	}

	setIpAddress(ipAddress: string): this {
		this.payload.ipAddress = ipAddress;
		return this;
	}

	setUserAgent(userAgent: string): this {
		this.payload.userAgent = userAgent;
		return this;
	}

	setPermissions(permissions: string[]): this {
		this.payload.permissions = permissions;
		return this;
	}

	addPermission(permission: string): this {
		if (!this.payload.permissions) {
			this.payload.permissions = [];
		}
		this.payload.permissions.push(permission);
		return this;
	}

	setCustomClaims(customClaims: Record<string, unknown>): this {
		this.payload.customClaims = customClaims;
		return this;
	}

	addCustomClaim(key: string, value: unknown): this {
		if (!this.payload.customClaims) {
			this.payload.customClaims = {};
		}
		this.payload.customClaims[key] = value;
		return this;
	}

	fromUser(user: User | UserAuthData): this {
		if (!user.roles || user.roles.length === 0) {
			throw new Error('User must have at least one role assigned');
		}

		let maxWeightSensitiveContent = 0;
		if (
			'maxWeightSensitiveContent' in user &&
			user.maxWeightSensitiveContent !== undefined
		) {
			maxWeightSensitiveContent = user.maxWeightSensitiveContent;
		} else {
			// Fallback: try to find max weight in roles if they have it
			const weights = user.roles
				.map(
					(role) =>
						(role as { maxWeightSensitiveContent?: number })
							.maxWeightSensitiveContent ?? 0,
				)
				.filter((w) => typeof w === 'number');

			if (weights.length > 0) {
				maxWeightSensitiveContent = Math.max(...weights);
			}
		}

		return this.setSubject(user.id)
			.setEmail(user.email)
			.setRoles(user.roles.map((role) => role.name))
			.setMaxWeightSensitiveContent(maxWeightSensitiveContent);
	}

	build(): JwtPayloadDto {
		if (!this.payload.sub) {
			throw new Error('Subject (sub) is required');
		}
		if (!this.payload.iss) {
			throw new Error('Issuer (iss) is required');
		}
		if (!this.payload.email) {
			throw new Error('Email is required');
		}
		if (!this.payload.roles || this.payload.roles.length === 0) {
			throw new Error('At least one role is required');
		}
		if (this.payload.maxWeightSensitiveContent === undefined) {
			throw new Error('Max weight sensitive content is required');
		}

		return this.payload as JwtPayloadDto;
	}

	reset(): this {
		this.payload = {};
		return this;
	}
}
