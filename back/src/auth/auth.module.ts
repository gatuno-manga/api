import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AppConfigModule } from 'src/app-config/app-config.module';
import { EncryptionModule } from 'src/encryption/encryption.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from 'src/users/entitys/user.entity';
import { JwtModule } from '@nestjs/jwt';
import { AppConfigService } from 'src/app-config/app-config.service';

@Module({
  imports: [
    EncryptionModule,
    AppConfigModule,
    TypeOrmModule.forFeature([User]),
    JwtModule.registerAsync({
      imports: [AppConfigModule],
      inject: [AppConfigService],
      useFactory: async (appConfigService: AppConfigService) => ({
        secret: appConfigService.JwtAccessSecret,
        signOptions: {
          expiresIn: appConfigService.jwtAccessExpiration,
        },
      }),
    })
  ],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
