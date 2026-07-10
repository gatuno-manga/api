import { IUserBookCustomizationRepository } from '@/interactions/application/ports/user-book-customization-repository.interface';
import { UserBookCustomization } from '@/interactions/domain/entities/user-book-customization';
import { UserBookCustomizationEntity } from '@/interactions/infrastructure/database/entities/user-book-customization.entity';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class TypeOrmUserBookCustomizationRepository
	implements IUserBookCustomizationRepository
{
	constructor(
		@InjectRepository(UserBookCustomizationEntity)
		private readonly repository: Repository<UserBookCustomizationEntity>,
	) {}

	async findByUserIdAndBookId(
		userId: string,
		bookId: string,
	): Promise<UserBookCustomization | null> {
		const entity = await this.repository.findOne({
			where: { userId, bookId },
		});
		return entity ? UserBookCustomization.restore(entity) : null;
	}

	async save(customization: UserBookCustomization): Promise<void> {
		const snapshot = customization.toSnapshot();
		await this.repository.save(snapshot);
	}

	async remove(customization: UserBookCustomization): Promise<void> {
		const snapshot = customization.toSnapshot();
		await this.repository.delete({
			userId: snapshot.userId,
			bookId: snapshot.bookId,
		});
	}
}
