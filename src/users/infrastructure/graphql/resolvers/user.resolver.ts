import { CacheTTL } from '@nestjs/cache-manager';
import { UseGuards, UseInterceptors } from '@nestjs/common';
import { Args, ID, Query, Resolver } from '@nestjs/graphql';
import { AdminUsersService } from '@users/application/use-cases/admin-users.service';
import { PaginatedUserResponseModel } from '@users/infrastructure/graphql/models/paginated-user-response.model';
import { UserFilterInput } from '@users/infrastructure/graphql/models/user-filter.input';
import { UserModel } from '@users/infrastructure/graphql/models/user.model';
import { GqlJwtAuthGuard } from 'src/auth/infrastructure/framework/gql-jwt-auth.guard';
import { UserAwareCacheInterceptor } from 'src/common/interceptors/user-aware-cache.interceptor';
import { PermissionsGuard } from 'src/users/application/services/permissions.guard';
import { Permissions } from 'src/users/domain/decorators/permissions.decorator';
import { PermissionsEnum } from 'src/users/domain/enums/permissions.enum';

@Resolver(() => UserModel)
@UseGuards(GqlJwtAuthGuard, PermissionsGuard)
export class UserResolver {
	constructor(private readonly adminUsersService: AdminUsersService) {}

	@Query(() => PaginatedUserResponseModel, { name: 'users' })
	@Permissions(PermissionsEnum.USERS_VIEW)
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
	@Permissions(PermissionsEnum.USERS_VIEW)
	async getUserById(@Args('id', { type: () => ID }) id: string) {
		return this.adminUsersService.getUserById(id);
	}
}
