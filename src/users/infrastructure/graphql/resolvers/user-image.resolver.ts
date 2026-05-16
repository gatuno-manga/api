import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { StorageBucket } from '@common/enum/storage-bucket.enum';
import { MediaUrlService } from 'src/common/services/media-url.service';
import { UserImageModel } from '../models/user.model';

@Resolver(() => UserImageModel)
export class UserImageResolver {
	constructor(private readonly mediaUrlService: MediaUrlService) {}

	@ResolveField(() => String, { name: 'url' })
	resolveUrl(@Parent() userImage: UserImageModel): string {
		return this.mediaUrlService.resolveUrl(
			userImage.url,
			StorageBucket.USERS,
		);
	}
}
