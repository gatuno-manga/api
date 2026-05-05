import {
	Body,
	Controller,
	Get,
	Patch,
	UploadedFile,
	UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from 'src/auth/infrastructure/framework/current-user.decorator';
import { CurrentUserDto } from 'src/auth/application/dto/current-user.dto';
import { DataEnvelopeInterceptor } from 'src/common/interceptors/data-envelope.interceptor';
import { AuthenticatedApi } from 'src/common/swagger/auth-api.decorators';
import { UpdateUserDto } from '@users/infrastructure/http/dto/update-user.dto';
import { UsersService } from '@users/application/use-cases/users.service';
import {
	ApiDocsGetCurrentUser,
	ApiDocsUpdateUser,
	ApiDocsUploadAvatar,
	ApiDocsUploadBanner,
} from './swagger/users.swagger';

@ApiTags('Users')
@Controller('users')
@AuthenticatedApi()
@UseInterceptors(DataEnvelopeInterceptor)
export class UsersController {
	constructor(private readonly usersService: UsersService) {}

	@Get('me')
	@ApiDocsGetCurrentUser()
	async getCurrentUser(@CurrentUser() user: CurrentUserDto) {
		return this.usersService.getCurrentUser(user.userId);
	}

	@Patch()
	@ApiDocsUpdateUser()
	async updateUser(
		@Body() dto: UpdateUserDto,
		@CurrentUser() user: CurrentUserDto,
	) {
		return this.usersService.updateUser(dto, user.userId);
	}

	@Patch('me/avatar')
	@ApiDocsUploadAvatar()
	@UseInterceptors(
		FileInterceptor('file', {
			limits: {
				fileSize: 5 * 1024 * 1024,
				files: 1,
			},
		}),
	)
	async uploadAvatar(
		@UploadedFile() file: Express.Multer.File,
		@CurrentUser() user: CurrentUserDto,
	) {
		return this.usersService.uploadAvatar(file, user.userId);
	}

	@Patch('me/banner')
	@ApiDocsUploadBanner()
	@UseInterceptors(
		FileInterceptor('file', {
			limits: {
				fileSize: 10 * 1024 * 1024,
				files: 1,
			},
		}),
	)
	async uploadBanner(
		@UploadedFile() file: Express.Multer.File,
		@CurrentUser() user: CurrentUserDto,
	) {
		return this.usersService.uploadBanner(file, user.userId);
	}
}
