import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { IUserRepository } from '@users/application/ports/user-repository.interface';
import { User as DomainUser } from '@users/domain/entities/user';
import { User as InfrastructureUser } from '@users/infrastructure/database/entities/user.entity';

@Injectable()
export class TypeOrmUserRepositoryAdapter implements IUserRepository {
	constructor(
		@InjectRepository(InfrastructureUser)
		private readonly repository: Repository<InfrastructureUser>,
	) {}

	async findById(id: string): Promise<DomainUser | null> {
		const user = await this.repository.findOne({
			where: { id } as FindOptionsWhere<InfrastructureUser>,
		});
		return user as unknown as DomainUser;
	}

	async save(user: DomainUser): Promise<DomainUser> {
		const saved = await this.repository.save(
			user as unknown as InfrastructureUser,
		);
		return saved as unknown as DomainUser;
	}
}
