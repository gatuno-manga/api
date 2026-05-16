import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { StorageBucket } from '@common/enum/storage-bucket.enum';
import { MediaUrlService } from 'src/common/services/media-url.service';
import { CoverModel } from '../models/book.model';
import { PageModel } from '../models/page.model';

@Resolver(() => CoverModel)
export class CoverResolver {
	constructor(private readonly mediaUrlService: MediaUrlService) {}

	@ResolveField(() => String, { name: 'url' })
	resolveUrl(@Parent() cover: CoverModel): string {
		return this.mediaUrlService.resolveUrl(cover.url, StorageBucket.BOOKS);
	}
}

@Resolver(() => PageModel)
export class PageResolver {
	constructor(private readonly mediaUrlService: MediaUrlService) {}

	@ResolveField(() => String, { name: 'path' })
	resolvePath(@Parent() page: PageModel): string {
		return this.mediaUrlService.resolveUrl(page.path, StorageBucket.BOOKS);
	}
}
