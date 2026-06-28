import { Field, ObjectType } from '@nestjs/graphql';
import { DashboardCountsType } from './dashboard-counts.type';
import { DashboardNameCountItemType } from './dashboard-name-count.type';
import { DashboardStatusType } from './dashboard-status.type';

@ObjectType()
export class DashboardOverviewType {
	@Field(() => DashboardCountsType)
	counts: DashboardCountsType;

	@Field(() => DashboardStatusType)
	status: DashboardStatusType;

	@Field(() => [DashboardNameCountItemType])
	sensitiveContent: DashboardNameCountItemType[];

	@Field(() => [DashboardNameCountItemType])
	tags: DashboardNameCountItemType[];
}
