import { DomainException } from '@common/domain/exceptions/domain.exception';
import { ResourceNotFoundException } from '@common/domain/exceptions/resource-not-found.exception';
import {
	BadRequestException,
	Body,
	Controller,
	Get,
	NotFoundException,
	Param,
	Put,
	UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserPreferencesService } from '@users/application/use-cases/user-preferences.service';
import { PutPreferenceSectionDto } from '@users/infrastructure/http/dto/put-preference-section.dto';
import { CurrentUserDto } from 'src/auth/application/dto/current-user.dto';
import { CurrentUser } from 'src/auth/infrastructure/framework/current-user.decorator';
import { DataEnvelopeInterceptor } from 'src/common/interceptors/data-envelope.interceptor';
import { AuthenticatedApi } from 'src/common/swagger/auth-api.decorators';
import { Permissions } from 'src/users/domain/decorators/permissions.decorator';
import { PermissionsEnum } from 'src/users/domain/enums/permissions.enum';
import {
	ApiDocsGetPreferenceSection,
	ApiDocsGetPreferences,
	ApiDocsPutPreferenceSection,
} from './swagger/user-preferences.swagger';

@ApiTags('User Preferences')
@Controller('users/me/preferences')
@AuthenticatedApi()
@UseInterceptors(DataEnvelopeInterceptor)
export class UserPreferencesController {
	constructor(
		private readonly userPreferencesService: UserPreferencesService,
	) {}

	@Get()
	@Permissions(PermissionsEnum.PROFILE_VIEW)
	@ApiDocsGetPreferences()
	async getPreferences(@CurrentUser() user: CurrentUserDto) {
		return this.translateDomainErrors(() =>
			this.userPreferencesService.getPreferences(user.userId),
		);
	}

	@Get(':section')
	@Permissions(PermissionsEnum.PROFILE_VIEW)
	@ApiDocsGetPreferenceSection()
	async getSection(
		@Param('section') section: string,
		@CurrentUser() user: CurrentUserDto,
	) {
		return this.translateDomainErrors(() =>
			this.userPreferencesService.getSection(user.userId, section),
		);
	}

	@Put(':section')
	@Permissions(PermissionsEnum.PROFILE_MANAGE)
	@ApiDocsPutPreferenceSection()
	async putSection(
		@Param('section') section: string,
		@Body() dto: PutPreferenceSectionDto,
		@CurrentUser() user: CurrentUserDto,
	) {
		return this.translateDomainErrors(() =>
			this.userPreferencesService.putSection(
				user.userId,
				section,
				dto.data,
				new Date(dto.updatedAt),
			),
		);
	}

	private async translateDomainErrors<T>(
		action: () => Promise<T>,
	): Promise<T> {
		try {
			return await action();
		} catch (error) {
			if (error instanceof ResourceNotFoundException) {
				throw new NotFoundException(error.message);
			}
			if (error instanceof DomainException) {
				throw new BadRequestException(error.message);
			}
			throw error;
		}
	}
}
