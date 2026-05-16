import {
	BadRequestException,
	Inject,
	Injectable,
	Logger,
} from '@nestjs/common';
import { PasswordEncryption } from 'src/infrastructure/encryption/password-encryption.provider';
import { EmailVO } from '@auth/domain/value-objects/email.vo';
import { UserRepositoryPort } from '@auth/application/ports/user-repository.port';

@Injectable()
export class SignUpUseCase {
	private readonly logger = new Logger(SignUpUseCase.name);

	constructor(
		@Inject('UserRepositoryPort')
		private readonly userRepository: UserRepositoryPort,
		private readonly passwordEncryption: PasswordEncryption,
	) {}

	async execute(emailStr: string, password: string, isAdmin = false) {
		const email = new EmailVO(emailStr);
		const userExist = await this.userRepository.findByEmail(email);

		if (userExist) {
			this.logger.error('User exists', userExist);
			throw new BadRequestException('User already exists');
		}

		const hashedPassword = await this.passwordEncryption.encrypt(password);
		const roleName = isAdmin ? 'admin' : 'user';

		const user = await this.userRepository.save({
			userName: email.value.split('@')[0],
			email: email.value,
			password: hashedPassword,
			roleName,
		});

		this.logger.log('User created', user);
		return user;
	}
}
