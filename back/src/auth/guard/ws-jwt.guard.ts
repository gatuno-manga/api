import {
	CanActivate,
	ExecutionContext,
	Injectable,
	Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { ROLES_KEY } from '../decorator/roles.decorator';

interface WsJwtPayload {
	sub?: string;
	roles?: string[];
	[key: string]: unknown;
}

/**
 * Guard WebSocket para autenticação JWT
 * Valida token no handshake e verifica roles quando necessário
 */
@Injectable()
export class WsJwtGuard implements CanActivate {
	private readonly logger = new Logger(WsJwtGuard.name);

	constructor(
		private readonly jwtService: JwtService,
		private readonly reflector: Reflector,
	) {}

	canActivate(context: ExecutionContext): boolean {
		try {
			const client: Socket = context.switchToWs().getClient<Socket>();
			const token = this.extractTokenFromHandshake(client);

			if (!token) {
				throw new WsException('Token not provided');
			}

			const payload = this.jwtService.verify(token) as WsJwtPayload;

			// Anexa o payload ao client para uso posterior
			client.data.user = payload;

			// Verifica roles se necessário
			const requiredRoles = this.reflector.getAllAndOverride<string[]>(
				ROLES_KEY,
				[context.getHandler(), context.getClass()],
			);

			if (requiredRoles) {
				const userRoles: string[] = payload.roles || [];
				const hasRole = requiredRoles.some((role: string) =>
					userRoles.includes(role),
				);

				if (!hasRole) {
					this.logger.warn(
						`User ${String(payload.sub)} lacks required roles: ${requiredRoles.join(', ')}`,
					);
					throw new WsException('Insufficient permissions');
				}
			}

			return true;
		} catch (error: unknown) {
			this.logger.error(
				`WebSocket authentication failed: ${error instanceof Error ? error.message : String(error)}`,
			);
			throw new WsException('Authentication failed');
		}
	}

	private extractTokenFromHandshake(client: Socket): string | null {
		// Tenta extrair token de várias fontes
		const authHeader = client.handshake.headers.authorization;
		const queryToken = (client.handshake.auth as Record<string, unknown>)
			?.token as string | undefined;
		const queryParam = client.handshake.query?.token;

		if (authHeader && typeof authHeader === 'string') {
			const [type, token] = authHeader.split(' ');
			return type === 'Bearer' ? token : null;
		}

		return (queryToken || queryParam) as string | null;
	}
}
