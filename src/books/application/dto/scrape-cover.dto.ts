import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUrl } from 'class-validator';

export class ScrapeCoverDto {
	@ApiProperty({
		description: 'External URL of the image to scrape as cover',
		example: 'https://example.com/cover.jpg',
	})
	@IsNotEmpty()
	@IsUrl()
	url: string;
}
