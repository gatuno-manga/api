import { Body, Controller, Patch, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { CurrentUserDto } from 'src/auth/dto/current-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { CurrentUser } from 'src/auth/decorator/current-user.decorator';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Patch()
  async updateUser(
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: CurrentUserDto
  ) {
    return this.usersService.updateUser(dto, user.userId);
  }
}
