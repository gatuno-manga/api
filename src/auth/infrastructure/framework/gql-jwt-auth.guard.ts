import { ExecutionContext, Injectable } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class GqlJwtAuthGuard extends AuthGuard('jwt') {
	getRequest(context: ExecutionContext) {
		const ctx = GqlExecutionContext.create(context);
		const gqlCtx = ctx.getContext();
		if (gqlCtx?.req) {
			return gqlCtx.req;
		}
		return context.switchToHttp().getRequest();
	}
}
