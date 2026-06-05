import {
	UserAuthData,
	UserRepositoryPort,
	UserSaveInput,
} from '@auth/application/ports/user-repository.port';
import { EmailVO } from '@auth/domain/value-objects/email.vo';
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Role } from 'src/users/infrastructure/database/entities/role.entity';
import { User } from 'src/users/infrastructure/database/entities/user.entity';
import { Repository } from 'typeorm';

@Injectable()
export class TypeOrmUserRepositoryAdapter implements UserRepositoryPort {
	constructor(
		@InjectRepository(User)
		private readonly userRepository: Repository<User>,
		@InjectRepository(Role)
		private readonly roleRepository: Repository<Role>,
	) {}

	async findByEmail(email: EmailVO): Promise<UserAuthData | null> {
		const user = await this.userRepository.findOne({
			where: { email: email.value },
			relations: ['roles', 'roles.permissions'],
		});
		return user ? this.toDomain(user) : null;
	}

	async findCredentialsByEmail(email: EmailVO): Promise<UserAuthData | null> {
		const user = await this.userRepository
			.createQueryBuilder('user')
			.leftJoinAndSelect('user.roles', 'role')
			.leftJoinAndSelect('role.permissions', 'permission')
			.addSelect('user.password')
			.where('user.email = :email', { email: email.value })
			.getOne();

		return user ? this.toDomain(user) : null;
	}

	async save(input: UserSaveInput): Promise<UserAuthData> {
		const role = await this.roleRepository.findOne({
			where: { name: input.roleName },
			relations: ['permissions'],
		});

		if (!role) {
			throw new BadRequestException(
				`${input.roleName.charAt(0).toUpperCase() + input.roleName.slice(1)} role not found`,
			);
		}

		const user = await this.userRepository.save(
			this.userRepository.create({
				userName: input.userName,
				email: input.email,
				password: input.password,
				roles: [role],
			}),
		);

		user.roles = [role];
		return this.toDomain(user);
	}

	private toDomain(user: User): UserAuthData {
		return {
			id: user.id,
			email: user.email,
			password: user.password,
			userName: user.userName,
			maxWeightSensitiveContent: user.maxWeightSensitiveContent,
			roles: user.roles?.map((r) => ({
				name: r.name,
				maxWeightSensitiveContent: r.maxWeightSensitiveContent,
				permissions: r.permissions?.map((p) => ({ name: p.name })),
			})),
		};
	}
}
