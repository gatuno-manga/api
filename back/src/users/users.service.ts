import {
	Injectable,
	Logger,
	NotFoundException,
	OnApplicationBootstrap,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { UpdateUserDto } from './dto/update-user.dto';
import { Role } from './entities/role.entity';
import { User } from './entities/user.entity';
import { RolesEnum } from './enum/roles.enum';

@Injectable()
export class UsersService implements OnApplicationBootstrap {
	private readonly logger = new Logger(UsersService.name);
	constructor(
		@InjectRepository(User)
		private readonly userRepository: Repository<User>,
		@InjectRepository(Role)
		private readonly roleRepository: Repository<Role>,
		private readonly dataSource: DataSource,
	) {}

	async onApplicationBootstrap() {
		const roles = [
			{
				name: RolesEnum.ADMIN,
				maxWeightSensitiveContent: 99,
			},
			{
				name: RolesEnum.USER,
				maxWeightSensitiveContent: 4,
			},
		];

		const queryRunner = this.dataSource.createQueryRunner('master');

		for (const role of roles) {
			try {
				const exists = await queryRunner.connect().then(() => {
					return this.roleRepository.manager.find(Role, {
						where: { name: role.name },
					});
				});

				if (!exists || exists.length === 0) {
					await this.roleRepository.save(
						this.roleRepository.create(role),
					);
					this.logger.log(`Role '${role.name}' created successfully`);
				} else {
					this.logger.debug(
						`Role '${role.name}' already exists, skipping`,
					);
				}
			} catch (error) {
				if (error.code === 'ER_DUP_ENTRY' || error.errno === 1062) {
					this.logger.warn(
						`Role '${role.name}' already exists (handled race condition)`,
					);
				} else {
					this.logger.error(
						`Error creating role '${role.name}': ${error.message}`,
						error.stack,
					);
					throw error;
				}
			}
		}
	}

	async updateUser(dto: UpdateUserDto, userId: string): Promise<User> {
		const user = await this.userRepository.findOne({
			where: { id: userId },
		});
		if (!user) {
			throw new NotFoundException(`User with id ${userId} not found`);
		}
		return this.userRepository.save(this.userRepository.merge(user, dto));
	}
}
