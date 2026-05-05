import {
	Body,
	Controller,
	Delete,
	Get,
	Param,
	ParseUUIDPipe,
	Patch,
	Post,
	UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SWAGGER_AUTH_SCHEME } from 'src/common/swagger/swagger-auth.constants';
import { Throttle } from '@nestjs/throttler';
import { Roles } from 'src/auth/infrastructure/framework/roles.decorator';
import { JwtAuthGuard } from 'src/auth/infrastructure/framework/jwt-auth.guard';
import { RolesEnum } from 'src/users/domain/enums/roles.enum';
import { RegisterWebSiteDto } from '../../../application/dto/register-website.dto';
import { UpdateWebsiteDto } from '../../../application/dto/update-website.dto';
import { WebsiteService } from '../../../application/services/website.service';
import {
	ApiDocsRegisterWebsite,
	ApiDocsFindAll,
	ApiDocsFindOne,
	ApiDocsUpdate,
	ApiDocsRemove,
} from './swagger/website.swagger';

@ApiTags('Website Scraping')
@Controller('website')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth(SWAGGER_AUTH_SCHEME)
export class WebsiteController {
	constructor(private readonly websiteService: WebsiteService) {}

	@Post()
	@Throttle({ short: { limit: 5, ttl: 300000 } }) // 5 req/5min
	@Roles(RolesEnum.ADMIN)
	@ApiDocsRegisterWebsite()
	async registerWebsite(@Body() dto: RegisterWebSiteDto) {
		return this.websiteService.registerWebsite(dto);
	}

	@Get()
	@Roles(RolesEnum.ADMIN)
	@ApiDocsFindAll()
	async findAll() {
		return this.websiteService.findAll();
	}

	@Get(':id')
	@Roles(RolesEnum.ADMIN)
	@ApiDocsFindOne()
	async findOne(@Param('id', ParseUUIDPipe) id: string) {
		return this.websiteService.findOne(id);
	}

	@Patch(':id')
	@Throttle({ short: { limit: 10, ttl: 300000 } }) // 10 req/5min
	@Roles(RolesEnum.ADMIN)
	@ApiDocsUpdate()
	async update(
		@Param('id', ParseUUIDPipe) id: string,
		@Body() dto: UpdateWebsiteDto,
	) {
		return this.websiteService.update(id, dto);
	}

	@Delete(':id')
	@Throttle({ short: { limit: 5, ttl: 300000 } }) // 5 req/5min
	@Roles(RolesEnum.ADMIN)
	@ApiDocsRemove()
	async remove(@Param('id', ParseUUIDPipe) id: string) {
		await this.websiteService.remove(id);
		return { message: 'Website deleted successfully' };
	}
}
