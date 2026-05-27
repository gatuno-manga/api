import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { GraphQLJSON } from 'graphql-type-json';

@ObjectType('UserImage')
export class UserImageModel {
	@Field(() => ID)
	id: string;

	@Field()
	url: string;
}

@ObjectType('Role')
export class RoleModel {
	@Field(() => ID)
	id: string;

	@Field()
	name: string;

	@Field(() => Int, { defaultValue: 0 })
	maxWeightSensitiveContent: number;
}

@ObjectType('UserGroup')
export class UserGroupModel {
	@Field(() => ID)
	id: string;

	@Field()
	name: string;

	@Field(() => String, { nullable: true })
	description: string | null;
}

@ObjectType('User')
export class UserModel {
	@Field(() => ID)
	id: string;

	@Field()
	userName: string;

	@Field(() => String, { nullable: true })
	name: string | null;

	@Field()
	email: string;

	@Field(() => Int, { defaultValue: 0 })
	maxWeightSensitiveContent: number;

	@Field(() => UserImageModel, { nullable: true })
	profilePicture?: UserImageModel | null;

	@Field(() => UserImageModel, { nullable: true })
	profileBanner?: UserImageModel | null;

	@Field()
	isBanned: boolean;

	@Field(() => Date, { nullable: true })
	suspendedUntil?: Date | null;

	@Field(() => String, { nullable: true })
	suspensionReason?: string | null;

	@Field(() => String, { defaultValue: 'pt-BR' })
	preferredLanguage: string;

	@Field(() => GraphQLJSON, { nullable: true })
	preferences?: Record<string, unknown>;

	@Field(() => [RoleModel], { nullable: 'itemsAndList' })
	roles?: RoleModel[];

	@Field(() => [UserGroupModel], { nullable: 'itemsAndList' })
	groups?: UserGroupModel[];

	@Field()
	createdAt: Date;

	@Field()
	updatedAt: Date;
}
