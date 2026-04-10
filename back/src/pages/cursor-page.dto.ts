import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';

export class CursorPageDto<T> {
	@ApiProperty({
		description: 'Array of items for the current cursor page',
		isArray: true,
	})
	@IsArray()
	readonly data: T[];

	@ApiProperty({
		nullable: true,
		required: false,
		description:
			'Cursor for the next page. Null when there are no more items.',
	})
	@IsOptional()
	@IsString()
	nextCursor: string | null;

	@ApiProperty({
		description:
			'Indicates whether more items are available after this page.',
	})
	@IsBoolean()
	hasNextPage: boolean;

	constructor(data: T[], nextCursor: string | null, hasNextPage: boolean) {
		this.data = data;
		this.nextCursor = nextCursor;
		this.hasNextPage = hasNextPage;
	}
}
