import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { getSupportedLanguages } from '../../../domain/constants/languages.constant';
import { ApiDocsListLanguages } from './swagger/languages.swagger';

@ApiTags('Languages')
@Controller('languages')
export class LanguagesController {
	@Get()
	@ApiDocsListLanguages()
	listLanguages(@Query('lang') displayLang?: string) {
		return getSupportedLanguages(displayLang || 'pt-BR');
	}
}
