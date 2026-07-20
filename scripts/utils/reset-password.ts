import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { PasswordEncryption } from '../../src/infrastructure/encryption/password-encryption.provider';
import { User } from '../../src/users/infrastructure/database/entities/user.entity';

async function bootstrap() {
	const email = process.argv[2];
	const newPassword = process.argv[3];

	if (!email || !newPassword) {
		console.error(
			'Usage: npm run cli:reset-password <email> <newPassword>',
		);
		process.exit(1);
	}

	console.log(`Starting password reset for ${email}...`);
	const app = await NestFactory.createApplicationContext(AppModule);

	const dataSource = app.get(DataSource);
	const passwordEncryption = app.get(PasswordEncryption);

	const userRepository = dataSource.getRepository(User);
	const user = await userRepository.findOne({ where: { email } });

	if (!user) {
		console.error(`User with email ${email} not found.`);
		await app.close();
		process.exit(1);
	}

	try {
		const newHash = await passwordEncryption.encrypt(newPassword);
		await userRepository.update(user.id, { password: newHash });
		console.log(`Password successfully updated for ${email}.`);
	} catch (err) {
		console.error('Failed to reset password', err);
	}

	await app.close();
}

bootstrap().catch((err) => {
	console.error('Error in bootstrap:', err);
	process.exit(1);
});
