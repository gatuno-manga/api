import { DashboardFilterInput } from '@/dashboard/application/graphql/inputs/dashboard-filter.input';
import { DashboardOverviewType } from '@/dashboard/application/graphql/types/dashboard-overview.type';
import { GetDashboardOverviewUseCase } from '@/dashboard/application/use-cases/get-dashboard-overview.use-case';
import { UseGuards } from '@nestjs/common';
import { Args, Query, Resolver } from '@nestjs/graphql';
import { GqlJwtAuthGuard } from 'src/auth/infrastructure/framework/gql-jwt-auth.guard';
import { Roles } from 'src/auth/infrastructure/framework/roles.decorator';
import { RolesEnum } from 'src/users/domain/enums/roles.enum';

@Resolver(() => DashboardOverviewType)
@UseGuards(GqlJwtAuthGuard)
@Roles(RolesEnum.ADMIN)
export class DashboardResolver {
	constructor(
		private readonly getDashboardOverviewUseCase: GetDashboardOverviewUseCase,
	) {}

	@Query(() => DashboardOverviewType, { name: 'dashboardOverview' })
	async getOverview(
		@Args('filter', { nullable: true }) filter?: DashboardFilterInput,
	) {
		return this.getDashboardOverviewUseCase.execute(filter);
	}
}
