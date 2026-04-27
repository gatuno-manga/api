import { UserImage } from '../../domain/entities/user-image';

export interface IUserImageRepository {
	update(criteria: unknown, data: Partial<UserImage>): Promise<void>;
	updateBatch(
		updates: { oldPath: string; newPath: string; metadata?: unknown }[],
	): Promise<void>;
}

export const I_USER_IMAGE_REPOSITORY = 'IUserImageRepository';
