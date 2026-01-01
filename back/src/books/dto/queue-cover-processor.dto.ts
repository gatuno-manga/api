import { UrlImageDto } from './url-image.dto';

export class QueueCoverProcessorDto {
	bookId: string;
	urlOrigin: string;
	covers: UrlImageDto[];
}
