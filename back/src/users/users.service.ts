import { Injectable, NotFoundException } from '@nestjs/common';
import { User } from './entitys/user.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>
    ) {}

    async updateUser(dto: UpdateUserDto, userId: string): Promise<User> {
        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (!user) {
            throw new NotFoundException(`User with id ${userId} not found`);
        }

        return this.userRepository.save(
            this.userRepository.merge(user, dto)
        );
    }
}
