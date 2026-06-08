import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { RolesEnum } from 'src/users/domain/enums/roles.enum';
import { Role } from 'src/users/infrastructure/database/entities/role.entity';
import { User } from 'src/users/infrastructure/database/entities/user.entity';
import { Repository } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';

export type OAuthProvider = 'google' | 'discord' | 'github';

@Injectable()
export class OAuthLoginUseCase {
	constructor(
		@InjectRepository(User)
		private readonly userRepository: Repository<User>,
		@InjectRepository(Role)
		private readonly roleRepository: Repository<Role>,
	) {}

	async execute(
		provider: OAuthProvider,
		providerId: string,
		email: string,
		name?: string,
		existingUserId?: string,
	): Promise<User> {
		const idField = `${provider}Id` as keyof User;

		if (existingUserId) {
			const existingUser = await this.userRepository.findOne({
				where: { id: existingUserId },
				relations: ['roles', 'roles.permissions'],
			});
			if (existingUser) {
				// biome-ignore lint/suspicious/noExplicitAny: Dynamic assignment of providerId
				(existingUser as any)[idField] = providerId;
				return this.userRepository.save(existingUser);
			}
		}

		// 1. Tenta buscar pelo ID do provedor
		let user = await this.userRepository.findOne({
			where: { [idField]: providerId },
			relations: ['roles', 'roles.permissions'],
		});
		if (user) return user;

		// 2. Tenta buscar pelo email e vincula a conta caso exista
		user = await this.userRepository.findOne({
			where: { email },
			relations: ['roles', 'roles.permissions'],
		});
		if (user) {
			if (provider === 'google') user.googleId = providerId;
			else if (provider === 'discord') user.discordId = providerId;
			else if (provider === 'github') user.githubId = providerId;
			return this.userRepository.save(user);
		}

		// 3. Se não existe, cria um novo usuário
		const defaultRole = await this.roleRepository.findOne({
			where: { name: RolesEnum.USER },
		});

		user = this.userRepository.create({
			email,
			userName: `${email.split('@')[0]}-${uuidv7().substring(0, 5)}`,
			name: name || null,
			password: null, // Sem senha pois logou via rede social
			roles: defaultRole ? [defaultRole] : [],
		});

		if (provider === 'google') user.googleId = providerId;
		else if (provider === 'discord') user.discordId = providerId;
		else if (provider === 'github') user.githubId = providerId;

		return this.userRepository.save(user);
	}
}
