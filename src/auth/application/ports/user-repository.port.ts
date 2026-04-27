import { EmailVO } from '../../domain/value-objects/email.vo';

export interface UserAuthData {
	id: string;
	email: string;
	password?: string;
	userName: string;
	maxWeightSensitiveContent: number;
	roles?: { name: string; maxWeightSensitiveContent: number }[];
}

export interface UserSaveInput {
	userName: string;
	email: string;
	password: string;
	roleName: string;
}

export interface UserRepositoryPort {
	findByEmail(email: EmailVO): Promise<UserAuthData | null>;
	findCredentialsByEmail(email: EmailVO): Promise<UserAuthData | null>;
	save(input: UserSaveInput): Promise<UserAuthData>;
}
