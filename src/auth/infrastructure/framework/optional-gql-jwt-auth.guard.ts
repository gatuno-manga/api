import { ExecutionContext, Injectable } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OptionalGqlJwtAuthGuard extends AuthGuard('jwt') {
	getRequest(context: ExecutionContext) {
		const ctx = GqlExecutionContext.create(context);
		const gqlCtx = ctx.getContext();
		if (gqlCtx?.req) {
			return gqlCtx.req;
		}
		return context.switchToHttp().getRequest();
	}

	handleRequest<TUser = unknown>(err: unknown, user: TUser): TUser | null {
		if (err || !user) {
			return null;
		}
		return user;
	}
}
