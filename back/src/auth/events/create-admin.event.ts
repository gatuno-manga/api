import { OnEvent } from "@nestjs/event-emitter";
import { UsersService } from "../../users/users.service";
import { AuthService } from "../auth.service";
import { AppConfigService } from "src/app-config/app-config.service";
import { InjectRepository } from "@nestjs/typeorm";
import { User } from "src/users/entitys/user.entity";
import { Repository } from "typeorm";
import { Logger } from "@nestjs/common";

export class CreateAdminEvent {
    private readonly logger = new Logger(CreateAdminEvent.name);
    constructor(
        private readonly authService: AuthService,
        private readonly appConfigService: AppConfigService,
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
    ) {}

    @OnEvent('app.ready')
    async handle() {
        const userEmail = this.appConfigService.adminInfo.email;
        const userPassword = this.appConfigService.adminInfo.password;
        if (!userEmail || !userPassword) {
            return;
        }
        const user = await this.userRepository.findOneBy({ email: userEmail });
        if (user) {
            return;
        }
        const newUser = await this.authService.signUp(userEmail, userPassword, true);
        this.logger.log(`Admin user created: ${newUser?.email}`);
    }
}
