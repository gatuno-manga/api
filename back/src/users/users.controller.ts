import {
	Body,
	Controller,
	Get,
	Patch,
	UploadedFile,
	UseGuards,
	UseInterceptors,
} from '@nestjs/common';
import {
	ApiBody,
	ApiBearerAuth,
	ApiConsumes,
	ApiOperation,
	ApiResponse,
	ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from 'src/auth/decorator/current-user.decorator';
import { CurrentUserDto } from 'src/auth/dto/current-user.dto';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { DataEnvelopeInterceptor } from 'src/common/interceptors/data-envelope.interceptor';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@Controller('users')
@UseGuards(JwtAuthGuard)
@UseInterceptors(DataEnvelopeInterceptor)
export class UsersController {
	constructor(private readonly usersService: UsersService) {}

	@Get('me')
	@ApiOperation({
		summary: 'Get current user profile',
		description: 'Retrieve current user information',
	})
	@ApiResponse({ status: 200, description: 'User profile retrieved' })
	@ApiResponse({ status: 401, description: 'Unauthorized' })
	@ApiBearerAuth('JWT-auth')
	async getCurrentUser(@CurrentUser() user: CurrentUserDto) {
		return this.usersService.getCurrentUser(user.userId);
	}

	@Patch()
	@ApiOperation({
		summary: 'Update user profile',
		description: 'Update current user information',
	})
	@ApiResponse({ status: 200, description: 'User successfully updated' })
	@ApiResponse({ status: 400, description: 'Invalid input data' })
	@ApiResponse({ status: 401, description: 'Unauthorized' })
	@ApiBearerAuth('JWT-auth')
	async updateUser(
		@Body() dto: UpdateUserDto,
		@CurrentUser() user: CurrentUserDto,
	) {
		return this.usersService.updateUser(dto, user.userId);
	}

	@Patch('me/avatar')
	@ApiOperation({
		summary: 'Upload user avatar',
		description: 'Upload or replace current user profile image',
	})
	@ApiResponse({ status: 200, description: 'Avatar successfully updated' })
	@ApiResponse({ status: 400, description: 'Invalid image format' })
	@ApiResponse({ status: 401, description: 'Unauthorized' })
	@ApiBearerAuth('JWT-auth')
	@ApiConsumes('multipart/form-data')
	@ApiBody({
		schema: {
			type: 'object',
			properties: {
				file: {
					type: 'string',
					format: 'binary',
				},
			},
			required: ['file'],
		},
	})
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
	@ApiOperation({
		summary: 'Upload user banner',
		description: 'Upload or replace current user profile banner image',
	})
	@ApiResponse({ status: 200, description: 'Banner successfully updated' })
	@ApiResponse({ status: 400, description: 'Invalid image format' })
	@ApiResponse({ status: 401, description: 'Unauthorized' })
	@ApiBearerAuth('JWT-auth')
	@ApiConsumes('multipart/form-data')
	@ApiBody({
		schema: {
			type: 'object',
			properties: {
				file: {
					type: 'string',
					format: 'binary',
				},
			},
			required: ['file'],
		},
	})
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
