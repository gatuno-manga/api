import { OnEvent } from '@nestjs/event-emitter';
import { AuthService } from '../auth.service';
import { AppConfigService } from 'src/app-config/app-config.service';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from 'src/users/entitys/user.entity';
import { DataSource, Repository } from 'typeorm';
import { Logger } from '@nestjs/common';

export class CreateAdminEvent {
	private readonly logger = new Logger(CreateAdminEvent.name);
	constructor(
		private readonly authService: AuthService,
		private readonly appConfigService: AppConfigService,
		@InjectRepository(User)
		private readonly userRepository: Repository<User>,
		private readonly dataSource: DataSource,
	) {}

	@OnEvent('app.ready')
	async handle() {
		try {
			const queryRunner = this.dataSource.createQueryRunner('master');
			const userEmail = this.appConfigService.adminInfo.email;
			const userPassword = this.appConfigService.adminInfo.password;
			if (!userEmail || !userPassword) {
				this.logger.debug(
					'Admin credentials not configured, skipping admin creation',
				);
				return;
			}

			const user = await queryRunner.connect().then(() => {
				return this.userRepository.manager.findOne(User, {
					where: { email: userEmail },
				});
			});

			if (user) {
				this.logger.debug(`Admin user already exists: ${userEmail}`);
				return;
			}
			const newUser = await this.authService.signUp(
				userEmail,
				userPassword,
				true,
			);
			this.logger.log(`Admin user created: ${newUser?.email}`);
		} catch (error) {
			this.logger.error(
				`Error creating admin user: ${error.message}`,
				error.stack,
			);
		}
	}
}
