import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AppConfigModule } from 'src/app-config/app-config.module';
import { EncryptionModule } from 'src/encryption/encryption.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from 'src/users/entitys/user.entity';
import { JwtModule } from '@nestjs/jwt';
import { AppConfigService } from 'src/app-config/app-config.service';
import { PasswordEncryption } from 'src/encryption/password-encryption.provider';
import { JwtStrategy } from './strategy/jwt.strategy';
import { JwtAuthGuard } from './guard/jwt-auth.guard';
import { PassportModule } from '@nestjs/passport';
import { DataEncryptionProvider } from 'src/encryption/data-encryption.provider';
import { JwtRefreshStrategy } from './strategy/jwt-refresh.strategy';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-store';

@Module({
  imports: [
    EncryptionModule,
    AppConfigModule,
    PassportModule,
    TypeOrmModule.forFeature([User]),
    JwtModule.registerAsync({
      imports: [AppConfigModule],
      inject: [AppConfigService],
      useFactory: async (appConfigService: AppConfigService) => ({
        secret: appConfigService.jwtAccessSecret,
        signOptions: {
          expiresIn: appConfigService.jwtAccessExpiration,
        },
      }),
    }),
    CacheModule.register({
      store: redisStore,
      isGlobal: true,
      host: 'localhost',
      port: 6379,
    })
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordEncryption,
    DataEncryptionProvider,
    JwtStrategy,
    JwtAuthGuard,
    JwtRefreshStrategy
  ],
  exports: [JwtModule, JwtStrategy, JwtAuthGuard],
})
export class AuthModule {}
