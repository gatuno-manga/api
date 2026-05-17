import { AuthService } from '@auth/auth.service';
import { Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { AppConfigService } from 'src/infrastructure/app-config/app-config.service';
import { User } from 'src/users/infrastructure/database/entities/user.entity';
import { DataSource, Repository } from 'typeorm';

export class CreateAdminEvent {
	private readonly logger = new Logger(CreateAdminEvent.name);
	constructor(
		private readonly authService: AuthService,
		private readonly appConfigService: AppConfigService,
		@InjectRepository(User)
		private readonly userRepository: Repository<User>,
		readonly _dataSource: DataSource,
	) {}

	@OnEvent('app.ready')
	async handle() {
		try {
			const userEmail = this.appConfigService.admin.email;
			const userPassword = this.appConfigService.admin.password;
			if (!userEmail || !userPassword) {
				this.logger.debug(
					'Admin credentials not configured, skipping admin creation',
				);
				return;
			}

			const user = await this.userRepository.findOne({
				where: { email: userEmail },
				comment: 'force_master',
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
		} catch (error: unknown) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			const errorStack = error instanceof Error ? error.stack : undefined;
			this.logger.error(
				`Error creating admin user: ${errorMessage}`,
				errorStack,
			);
		}
	}
}
