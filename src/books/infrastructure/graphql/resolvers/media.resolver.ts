import { CoverModel } from '@books/infrastructure/graphql/models/book.model';
import { PageModel } from '@books/infrastructure/graphql/models/page.model';
import { StorageBucket } from '@common/enum/storage-bucket.enum';
import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { MediaUrlService } from 'src/common/services/media-url.service';

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
