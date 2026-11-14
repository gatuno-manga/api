import { ApiProperty } from '@nestjs/swagger';
import { IsISO8601, IsObject } from 'class-validator';

export class PutPreferenceSectionDto {
	@ApiProperty({
		description:
			'Client-owned JSON object (max 16 KB). The API stores it as is and never reads its fields.',
		type: 'object',
		additionalProperties: true,
		example: {
			version: 1,
			fontFamily: 'serif',
			fontSize: 19,
			lineHeight: 1.8,
			alignment: 'left',
			theme: 'sepia',
		},
	})
	@IsObject()
	data: Record<string, unknown>;

	@ApiProperty({
		description:
			'Client time of the change (ISO-8601). The newest write wins; more than 5 minutes in the future is rejected.',
		example: '2026-11-14T12:00:00.000Z',
	})
	@IsISO8601({ strict: true })
	updatedAt: string;
}
