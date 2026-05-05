import { UseGuards } from '@nestjs/common';
import { Args, ID, Query, Resolver } from '@nestjs/graphql';
import { JwtAuthGuard } from 'src/auth/infrastructure/framework/jwt-auth.guard';
import { Roles } from 'src/auth/infrastructure/framework/roles.decorator';
import { RolesEnum } from 'src/users/domain/enums/roles.enum';
import { GqlJwtAuthGuard } from 'src/auth/infrastructure/framework/gql-jwt-auth.guard';
import { AdminUsersService } from '@users/application/use-cases/admin-users.service';
import { UserFilterInput } from '@users/infrastructure/graphql/models/user-filter.input';
import { PaginatedUserResponseModel } from '@users/infrastructure/graphql/models/paginated-user-response.model';
import { UserModel } from '@users/infrastructure/graphql/models/user.model';

@Resolver(() => UserModel)
@UseGuards(GqlJwtAuthGuard)
@Roles(RolesEnum.ADMIN)
export class UserResolver {
	constructor(private readonly adminUsersService: AdminUsersService) {}

	@Query(() => PaginatedUserResponseModel, { name: 'users' })
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
