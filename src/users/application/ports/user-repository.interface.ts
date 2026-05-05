import { User } from '@users/domain/entities/user';

export interface IUserRepository {
	findById(id: string): Promise<User | null>;
	save(user: User): Promise<User>;
}

export const I_USER_REPOSITORY = 'IUserRepository';
