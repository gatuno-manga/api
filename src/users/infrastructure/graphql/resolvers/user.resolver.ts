import { CacheTTL } from '@nestjs/cache-manager';
import { UseGuards, UseInterceptors } from '@nestjs/common';
import { Args, ID, Query, Resolver } from '@nestjs/graphql';
import { AdminUsersService } from '@users/application/use-cases/admin-users.service';
import { PaginatedUserResponseModel } from '@users/infrastructure/graphql/models/paginated-user-response.model';
import { UserFilterInput } from '@users/infrastructure/graphql/models/user-filter.input';
import { UserModel } from '@users/infrastructure/graphql/models/user.model';
import { GqlJwtAuthGuard } from 'src/auth/infrastructure/framework/gql-jwt-auth.guard';
import { Roles } from 'src/auth/infrastructure/framework/roles.decorator';
import { UserAwareCacheInterceptor } from 'src/common/interceptors/user-aware-cache.interceptor';
import { RolesEnum } from 'src/users/domain/enums/roles.enum';

@Resolver(() => UserModel)
@UseGuards(GqlJwtAuthGuard)
@Roles(RolesEnum.ADMIN)
export class UserResolver {
	constructor(private readonly adminUsersService: AdminUsersService) {}

	@Query(() => PaginatedUserResponseModel, { name: 'users' })
	@UseInterceptors(UserAwareCacheInterceptor)
	@CacheTTL(30)
	async listUsers(
		@Args('filter', { nullable: true }) filter?: UserFilterInput,
	) {
		const result = await this.adminUsersService.listUsers({
			page: filter?.page ?? 1,
			limit: filter?.limit ?? 20,
			cursor: filter?.cursor,
			search: filter?.search,
			role: filter?.role,
			isBanned: filter?.isBanned,
			isSuspended: filter?.isSuspended,
		});

		// Adapt result to GQL model
		if ('meta' in result) {
			return {
				data: result.data,
				total: result.meta.total,
				page: result.meta.page,
				lastPage: result.meta.lastPage,
			};
		}

		return {
			data: result.data,
			nextCursor: result.nextCursor,
			hasNextPage: result.hasNextPage,
		};
	}

	@Query(() => UserModel, { name: 'user' })
	async getUserById(@Args('id', { type: () => ID }) id: string) {
		return this.adminUsersService.getUserById(id);
	}
}
