import { SensitiveContentFilter } from '@/dashboard/application/dto/dashboard-filter.dto';
import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class DashboardFilterInput {
	@Field(() => String, {
		nullable: true,
		defaultValue: SensitiveContentFilter.ALL,
	})
	sensitiveContent?: SensitiveContentFilter;
}
