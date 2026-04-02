import {
	BadRequestException,
	Injectable,
	Logger,
	NotFoundException,
	OnApplicationBootstrap,
} from '@nestjs/common';
import { FilesService } from 'src/files/files.service';
import { InjectRepository } from '@nestjs/typeorm';
import sharp from 'sharp';
import { DataSource, Repository } from 'typeorm';
import { UpdateUserDto } from './dto/update-user.dto';
import { Role } from './entities/role.entity';
import { User } from './entities/user.entity';
import { RolesEnum } from './enum/roles.enum';
import { UserResourcesMapper } from './user-resources.mapper';

@Injectable()
export class UsersService implements OnApplicationBootstrap {
	private readonly logger = new Logger(UsersService.name);
	private readonly maxAvatarSizeBytes = 5 * 1024 * 1024;
	private readonly maxBannerSizeBytes = 10 * 1024 * 1024;
	private readonly allowedAvatarMimeTypes = new Set([
		'image/png',
		'image/jpeg',
		'image/webp',
	]);
	constructor(
		@InjectRepository(User)
		private readonly userRepository: Repository<User>,
		@InjectRepository(Role)
		private readonly roleRepository: Repository<Role>,
		private readonly dataSource: DataSource,
		private readonly filesService: FilesService,
		private readonly userResourcesMapper: UserResourcesMapper,
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

	async getCurrentUser(userId: string) {
		const user = await this.userRepository.findOne({
			where: { id: userId },
		});

		if (!user) {
			throw new NotFoundException(`User with id ${userId} not found`);
		}

		return this.userResourcesMapper.toUserProfile(user);
	}

	async getPublicUserProfile(userId: string) {
		const user = await this.userRepository.findOne({
			where: { id: userId },
		});

		if (!user) {
			throw new NotFoundException(`User with id ${userId} not found`);
		}

		return this.userResourcesMapper.toPublicUserProfile(user);
	}

	async uploadAvatar(file: Express.Multer.File, userId: string) {
		const user = await this.findUserOrFail(userId);
		const extension = await this.validateAndResolveImageExtension(
			file,
			this.maxAvatarSizeBytes,
			'avatar',
		);
		const publicPath = await this.filesService.saveBufferFile(
			file.buffer,
			extension,
		);

		if (user.profileImagePath) {
			await this.filesService.deleteFile(user.profileImagePath);
		}

		user.profileImagePath = publicPath;
		const savedUser = await this.userRepository.save(user);
		return this.userResourcesMapper.toUserProfile(savedUser);
	}

	async uploadBanner(file: Express.Multer.File, userId: string) {
		const user = await this.findUserOrFail(userId);
		const extension = await this.validateAndResolveImageExtension(
			file,
			this.maxBannerSizeBytes,
			'banner',
		);
		const publicPath = await this.filesService.saveBufferFile(
			file.buffer,
			extension,
		);

		if (user.profileBannerPath) {
			await this.filesService.deleteFile(user.profileBannerPath);
		}

		user.profileBannerPath = publicPath;
		const savedUser = await this.userRepository.save(user);
		return this.userResourcesMapper.toUserProfile(savedUser);
	}

	private async findUserOrFail(userId: string): Promise<User> {
		const user = await this.userRepository.findOne({
			where: { id: userId },
		});

		if (!user) {
			throw new NotFoundException(`User with id ${userId} not found`);
		}

		return user;
	}

	private async validateAndResolveImageExtension(
		file: Express.Multer.File,
		maxSizeBytes: number,
		label: 'avatar' | 'banner',
	): Promise<string> {
		if (!file) {
			throw new BadRequestException(`${label} file is required`);
		}

		if (!file.buffer || file.size === 0) {
			throw new BadRequestException(`${label} file is empty`);
		}

		if (file.size > maxSizeBytes) {
			const maxSizeMb = Math.floor(maxSizeBytes / (1024 * 1024));
			throw new BadRequestException(
				`${label} file is too large. Maximum size is ${maxSizeMb}MB`,
			);
		}

		if (!this.allowedAvatarMimeTypes.has(file.mimetype)) {
			throw new BadRequestException(
				'Unsupported avatar format. Use png, jpeg or webp',
			);
		}

		try {
			const metadata = await sharp(file.buffer).metadata();
			if (!metadata.width || !metadata.height) {
				throw new BadRequestException('Invalid image dimensions');
			}
		} catch {
			throw new BadRequestException('Invalid image content');
		}

		const extensionMap: Record<string, string> = {
			'image/png': '.png',
			'image/jpeg': '.jpg',
			'image/webp': '.webp',
		};

		const extension = extensionMap[file.mimetype];
		if (!extension) {
			throw new BadRequestException('Unsupported image format');
		}

		return extension;
	}
}
