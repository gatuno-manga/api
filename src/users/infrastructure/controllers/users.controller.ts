import {
	Body,
	Controller,
	Get,
	Patch,
	UploadedFile,
	UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags } from '@nestjs/swagger';
import { UsersService } from '@users/application/use-cases/users.service';
import { UpdateUserDto } from '@users/infrastructure/http/dto/update-user.dto';
import { CurrentUserDto } from 'src/auth/application/dto/current-user.dto';
import { CurrentUser } from 'src/auth/infrastructure/framework/current-user.decorator';
import { DataEnvelopeInterceptor } from 'src/common/interceptors/data-envelope.interceptor';
import { AuthenticatedApi } from 'src/common/swagger/auth-api.decorators';
import { Permissions } from 'src/users/domain/decorators/permissions.decorator';
import { PermissionsEnum } from 'src/users/domain/enums/permissions.enum';
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
	@Permissions(PermissionsEnum.BOOKS_VIEW)
	@ApiDocsGetCurrentUser()
	async getCurrentUser(@CurrentUser() user: CurrentUserDto) {
		return this.usersService.getCurrentUser(user.userId);
	}

	@Patch()
	@Permissions(PermissionsEnum.BOOKS_VIEW)
	@ApiDocsUpdateUser()
	async updateUser(
		@Body() dto: UpdateUserDto,
		@CurrentUser() user: CurrentUserDto,
	) {
		return this.usersService.updateUser(dto, user.userId);
	}

	@Patch('me/avatar')
	@Permissions(PermissionsEnum.BOOKS_VIEW)
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
	@Permissions(PermissionsEnum.BOOKS_VIEW)
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
