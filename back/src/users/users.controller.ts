import {
	Body,
	Controller,
	Get,
	Patch,
	UploadedFile,
	UseInterceptors,
} from '@nestjs/common';
import {
	ApiBody,
	ApiConsumes,
	ApiOperation,
	ApiResponse,
	ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from 'src/auth/decorator/current-user.decorator';
import { CurrentUserDto } from 'src/auth/dto/current-user.dto';
import { DataEnvelopeInterceptor } from 'src/common/interceptors/data-envelope.interceptor';
import { AuthenticatedApi } from 'src/common/swagger/auth-api.decorators';
import { COMMON_RESPONSES } from 'src/common/swagger/common-responses';
import { MULTIPART_SCHEMAS } from 'src/common/swagger/multipart-schemas';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@Controller('users')
@AuthenticatedApi()
@UseInterceptors(DataEnvelopeInterceptor)
export class UsersController {
	constructor(private readonly usersService: UsersService) {}

	@Get('me')
	@ApiOperation({
		summary: 'Obter perfil do usuario atual',
		description: 'Recupera as informacoes do usuario autenticado',
	})
	@ApiResponse({ status: 200, description: 'Perfil retornado com sucesso' })
	@ApiResponse(COMMON_RESPONSES.UNAUTHORIZED)
	async getCurrentUser(@CurrentUser() user: CurrentUserDto) {
		return this.usersService.getCurrentUser(user.userId);
	}

	@Patch()
	@ApiOperation({
		summary: 'Atualizar perfil do usuario',
		description: 'Atualiza as informacoes do usuario autenticado',
	})
	@ApiResponse({ status: 200, description: 'Usuario atualizado com sucesso' })
	@ApiResponse(COMMON_RESPONSES.BAD_REQUEST)
	@ApiResponse(COMMON_RESPONSES.UNAUTHORIZED)
	async updateUser(
		@Body() dto: UpdateUserDto,
		@CurrentUser() user: CurrentUserDto,
	) {
		return this.usersService.updateUser(dto, user.userId);
	}

	@Patch('me/avatar')
	@ApiOperation({
		summary: 'Enviar avatar do usuario',
		description: 'Envia ou substitui a imagem de perfil do usuario',
	})
	@ApiResponse({ status: 200, description: 'Avatar atualizado com sucesso' })
	@ApiResponse(COMMON_RESPONSES.BAD_REQUEST)
	@ApiResponse(COMMON_RESPONSES.UNAUTHORIZED)
	@ApiConsumes('multipart/form-data')
	@ApiBody({
		schema: MULTIPART_SCHEMAS.SINGLE_IMAGE_FILE,
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
		summary: 'Enviar banner do usuario',
		description: 'Envia ou substitui a imagem de banner do usuario',
	})
	@ApiResponse({ status: 200, description: 'Banner atualizado com sucesso' })
	@ApiResponse(COMMON_RESPONSES.BAD_REQUEST)
	@ApiResponse(COMMON_RESPONSES.UNAUTHORIZED)
	@ApiConsumes('multipart/form-data')
	@ApiBody({
		schema: MULTIPART_SCHEMAS.SINGLE_IMAGE_FILE,
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
