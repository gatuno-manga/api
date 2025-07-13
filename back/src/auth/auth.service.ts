import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { PasswordEncryption } from 'src/encryption/password-encryption.provider';
import { User } from 'src/users/entitys/user.entity';
import { Roles } from 'src/users/enum/roles.enum';
import { Repository } from 'typeorm';

@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name);
    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        private readonly passwordEncryption: PasswordEncryption,
        private readonly jwtService: JwtService,
    ) {}

    async signUp(email: string, password: string) {
        const userExist = await this.userRepository.findOneBy({ email });
        if (userExist) {
            this.logger.error('User exists', userExist);
            throw new BadRequestException('User already exists');
        }

        const result = await this.passwordEncryption.encrypt(password);
        const user = await this.userRepository.save({
            name: email.split('@')[0],
            email,
            password: result,
            roles: [Roles.USER],
        })
        this.logger.log('User create', user);
        return user;
    }

    async signIn(email: string, password: string) {
        const user = await this.userRepository.findOne({
            where: { email },
            select: ['id', 'email', 'password', 'roles'],
        });
        if (!user) {
            this.logger.error('User not exists', email);
            throw new UnauthorizedException('User not exists');
        }

        if (!(await this.passwordEncryption.compare(user.password, password))) {
            this.logger.error('Invalid password', email);
            throw new UnauthorizedException('Invalid password');
        }


        const payload = {
            email: user.email,
            sub: user.id,
            roles: user.roles,
            iss: 'login',
        };

        const accessToken = this.jwtService.sign(
            { ...payload },
        );

        return { accessToken };
    }
}
