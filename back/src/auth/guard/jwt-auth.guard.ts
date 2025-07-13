import {
	ExecutionContext,
	Injectable,
	Logger,
	UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { AuthGuard } from '@nestjs/passport';
import { ROLES_KEY } from '../decorator/roles.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
	private readonly logger = new Logger(JwtAuthGuard.name);
	constructor(
		private readonly reflector: Reflector,
		private readonly jwtService: JwtService,
	) {
		super();
	}

	async canActivate(context: ExecutionContext) {
		const canActivate = await super.canActivate(context);
		if (!canActivate) {
			this.logger.error('User is not authenticated');
			return false;
		}

		const requiredRoles = this.reflector.getAllAndOverride<string[]>(
			ROLES_KEY,
			[context.getHandler(), context.getClass()],
		);

		if (!requiredRoles) {
			return true;
		}

		const request = context.switchToHttp().getRequest();

		const token = request.headers.authorization?.split(' ')[1];
		if (!token) {
			throw new UnauthorizedException('No token provided');
		}

		const payload = this.jwtService.verify(token);

		const userRoles: string[] = payload.roles || [];

		const hasRole = () =>
			requiredRoles
				? requiredRoles.some((role) => userRoles.includes(role))
				: true;

		if (!hasRole()) {
			throw new UnauthorizedException('Insufficient permissions');
		}
		return true;
	}
}
