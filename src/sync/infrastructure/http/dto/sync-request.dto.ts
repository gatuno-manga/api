import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
	IsArray,
	IsBoolean,
	IsDateString,
	IsNotEmpty,
	IsOptional,
	IsString,
	ValidateNested,
} from 'class-validator';
import { CreateSavedPageDto } from '@users/infrastructure/http/dto/create-saved-page.dto';
import { SaveReadingProgressDto } from '@users/infrastructure/http/dto/reading-progress.dto';

export class SyncCommentDto {
	@ApiProperty({ description: 'ID do capítulo' })
	@IsString()
	@IsNotEmpty()
	chapterId: string;

	@ApiPropertyOptional({
		description: 'ID do comentário pai (se for resposta)',
	})
	@IsOptional()
	@IsString()
	parentId?: string;

	@ApiProperty({ description: 'Conteúdo do comentário' })
	@IsString()
	@IsNotEmpty()
	content: string;

	@ApiPropertyOptional({
		description: 'Se o comentário é público',
		default: true,
	})
	@IsOptional()
	@IsBoolean()
	isPublic?: boolean;
}

export class SyncRequestDto {
	@ApiPropertyOptional({
		description: 'Timestamp da última sincronização bem-sucedida',
		example: '2026-04-24T10:00:00Z',
	})
	@IsOptional()
	@IsDateString()
	lastSyncAt?: string;

	@ApiPropertyOptional({ type: [SaveReadingProgressDto] })
	@IsOptional()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => SaveReadingProgressDto)
	readingProgress?: SaveReadingProgressDto[];

	@ApiPropertyOptional({ type: [CreateSavedPageDto] })
	@IsOptional()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => CreateSavedPageDto)
	savedPages?: CreateSavedPageDto[];

	@ApiPropertyOptional({ type: [SyncCommentDto] })
	@IsOptional()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => SyncCommentDto)
	comments?: SyncCommentDto[];
}
