import {
	ExecutionContext,
	ForbiddenException,
	Injectable,
	Logger,
	UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { JwtService } from '@nestjs/jwt';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
	private readonly logger = new Logger(JwtAuthGuard.name);
	constructor(
		private readonly reflector: Reflector,
		private readonly jwtService: JwtService,
	) {
		super();
	}

	getRequest(context: ExecutionContext) {
		if (context.getType<string>() === 'graphql') {
			const ctx = GqlExecutionContext.create(context);
			return ctx.getContext().req;
		}
		return context.switchToHttp().getRequest();
	}

	async canActivate(context: ExecutionContext) {
		const canActivate = await super.canActivate(context);
		if (!canActivate) {
			return false;
		}

		const requiredRoles = this.reflector.getAllAndOverride<string[]>(
			ROLES_KEY,
			[context.getHandler(), context.getClass()],
		);

		if (!requiredRoles) {
			return true;
		}

		const request = this.getRequest(context);
		const user = request.user as { roles?: string[] };

		if (!user || !user.roles) {
			throw new UnauthorizedException('User roles not found');
		}

		const userRoles: string[] = user.roles;
		const hasRole = requiredRoles.some((role) => userRoles.includes(role));

		if (!hasRole) {
			throw new ForbiddenException('Insufficient roles');
		}
		return true;
	}
}
