export class DatabaseConfig {
	constructor(
		public readonly type: string,
		public readonly name: string,
		public readonly host: string,
		public readonly port: number,
		public readonly username: string,
		public readonly password: string,
		public readonly slaveHosts: string[],
	) {}
}

export class RedisConfig {
	constructor(
		public readonly host: string,
		public readonly port: number,
		public readonly password: string,
	) {}
}

export class JwtConfig {
	constructor(
		public readonly accessSecret: string,
		public readonly accessExpiration: string,
		public readonly refreshSecret: string,
		public readonly refreshExpiration: string,
		public readonly issuer: string,
		public readonly audience: string,
	) {}
}

export class SecurityConfig {
	constructor(
		public readonly saltLength: number,
		public readonly passwordKeyLength: number,
		public readonly mfaIssuerName: string,
		public readonly mfaEncryptionSecret: string,
		public readonly mfaStepUpEnabled: boolean,
		public readonly mfaChallengeExpiration: string,
		public readonly authApiKeyDefaultExpiration: string,
		public readonly authApiKeyMaxExpiration: string,
	) {}
}

export class AdminConfig {
	constructor(
		public readonly email: string,
		public readonly password: string,
	) {}
}

export class MeiliConfig {
	constructor(
		public readonly host: string,
		public readonly masterKey: string,
	) {}
}
