import {
	Body,
	Controller,
	Delete,
	Param,
	Patch,
	Post,
	UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SWAGGER_AUTH_SCHEME } from 'src/common/swagger/swagger-auth.constants';
import { Roles } from 'src/auth/infrastructure/framework/roles.decorator';
import { JwtAuthGuard } from 'src/auth/infrastructure/framework/jwt-auth.guard';
import { RolesEnum } from 'src/users/domain/enums/roles.enum';
import { CreateBookRelationshipDto } from '@books/application/dto/create-book-relationship.dto';
import { UpdateBookRelationshipDto } from '@books/application/dto/update-book-relationship.dto';
import { BookBookRelationshipService } from '@books/application/services/book-book-relationship.service';
import {
	ApiDocsCreateRelationship,
	ApiDocsUpdateRelationship,
	ApiDocsDeleteRelationship,
} from './swagger/admin-book-relationships.swagger';

@ApiTags('Books Admin')
@Controller('books')
@UseGuards(JwtAuthGuard)
@Roles(RolesEnum.ADMIN)
@ApiBearerAuth(SWAGGER_AUTH_SCHEME)
export class AdminBookRelationshipsController {
	constructor(
		private readonly bookBookRelationshipService: BookBookRelationshipService,
	) {}

	@Post(':idBook/relationships')
	@ApiDocsCreateRelationship()
	createRelationship(
		@Param('idBook') idBook: string,
		@Body() dto: CreateBookRelationshipDto,
	): Promise<unknown> {
		return this.bookBookRelationshipService.createRelationship(idBook, dto);
	}

	@Patch(':idBook/relationships/:idRelationship')
	@ApiDocsUpdateRelationship()
	updateRelationship(
		@Param('idBook') idBook: string,
		@Param('idRelationship') idRelationship: string,
		@Body() dto: UpdateBookRelationshipDto,
	): Promise<unknown> {
		return this.bookBookRelationshipService.updateRelationship(
			idBook,
			idRelationship,
			dto,
		);
	}

	@Delete(':idBook/relationships/:idRelationship')
	@ApiDocsDeleteRelationship()
	deleteRelationship(
		@Param('idBook') idBook: string,
		@Param('idRelationship') idRelationship: string,
	): Promise<unknown> {
		return this.bookBookRelationshipService.deleteRelationship(
			idBook,
			idRelationship,
		);
	}
}
