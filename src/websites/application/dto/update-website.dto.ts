import { PartialType } from '@nestjs/swagger';
import { RegisterWebSiteDto } from './register-website.dto';

export class UpdateWebsiteDto extends PartialType(RegisterWebSiteDto) {}
