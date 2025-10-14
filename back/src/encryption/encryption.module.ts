import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PasswordEncryption } from './password-encryption.provider';
import { PasswordMigrationService } from './password-migration.service';
import { AppConfigModule } from 'src/app-config/app-config.module';
import { AppConfigService } from 'src/app-config/app-config.service';
import { ScryptStrategy, BcryptStrategy, Argon2Strategy, HybridStrategy } from './strategies';
import { User } from 'src/users/entitys/user.entity';

/**
 * Módulo de criptografia que implementa o padrão Strategy para hashing de senhas.
 *
 * ✨ CONFIGURAÇÃO ATUAL: Híbrida (suporta Scrypt, Bcrypt e Argon2)
 * 🔄 MIGRAÇÃO: Automática e transparente via HybridStrategy
 * 🎯 NOVOS HASHES: Argon2 (máxima segurança)
 * ✅ SENHAS ANTIGAS: Validadas com Scrypt/Bcrypt (compatibilidade total)
 *
 * A HybridStrategy permite:
 * - Validar senhas antigas (Scrypt/Bcrypt) durante o login
 * - Gerar novos hashes usando Argon2 (mais seguro)
 * - Migração transparente sem downtime
 * - Zero impacto para usuários existentes
 */
@Module({
	imports: [
		AppConfigModule,
		TypeOrmModule.forFeature([User]), // Necessário para PasswordMigrationService
	],
	providers: [
		AppConfigService,

		// Registra todas as estratégias disponíveis (necessário para HybridStrategy)
		ScryptStrategy,
		BcryptStrategy,
		Argon2Strategy,
		HybridStrategy,

		// Define qual estratégia será usada (injeção de dependência)
		{
			provide: 'PASSWORD_HASHER',
			useClass: HybridStrategy, // ✅ ESTRATÉGIA HÍBRIDA (suporta todos os algoritmos)
		},

		// Provider principal que usa a estratégia
		PasswordEncryption,

		// Serviço de migração para transição entre algoritmos
		PasswordMigrationService,
	],
	exports: [PasswordEncryption, PasswordMigrationService],
})
export class EncryptionModule {}
