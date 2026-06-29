import { AppConfigService } from '@/infrastructure/app-config/app-config.service';
import {
	Body,
	Controller,
	ForbiddenException,
	HttpCode,
	Logger,
	Post,
	UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';

@ApiTags('MQTT Auth')
@SkipThrottle({ default: true, short: true, medium: true, long: true })
@Controller('auth/mqtt')
export class MqttAuthController {
	private readonly logger = new Logger(MqttAuthController.name);

	constructor(
		private readonly jwtService: JwtService,
		private readonly configService: ConfigService,
		private readonly appConfigService: AppConfigService,
	) {}

	@Post('connect')
	@HttpCode(200)
	async authenticateConnection(
		@Body() body: {
			clientid: string;
			username?: string;
			password?: string;
		},
	) {
		this.logger.debug(`MQTT Connect Request from ${body.clientid}`);

		// 1. Backend Service Authentication (Microservices)
		// Se for um serviço interno usando o secret do sistema
		const internalSecret = this.appConfigService.jwt.accessSecret; // Or a specific MQTT secret
		if (
			body.password === internalSecret ||
			body.username === 'internal-system'
		) {
			return { result: 'allow', is_superuser: true };
		}

		// 2. Client Authentication via JWT
		if (!body.password) {
			throw new UnauthorizedException('Password (JWT) is required');
		}

		try {
			// O token JWT deve ser passado no campo password
			const payload = this.jwtService.verify<{ sub: string }>(
				body.password,
				{
					secret: this.appConfigService.jwt.accessSecret,
					issuer: this.appConfigService.jwt.issuer,
					audience: this.appConfigService.jwt.audience,
				},
			);

			// Obriga que o username enviado pelo client seja o próprio userId (sub do JWT)
			// Assim podemos usar o username no webhook de ACL para identificar o usuário,
			// pois o broker não envia o password no payload de ACL.
			if (body.username !== payload.sub) {
				this.logger.warn(
					`MQTT Auth failed: username (${body.username}) does not match JWT sub (${payload.sub})`,
				);
				return { result: 'deny' };
			}

			// Podemos retornar allow e amarrar o username real do sistema
			return { result: 'allow', is_superuser: false };
		} catch (error) {
			this.logger.warn(`MQTT Auth failed: ${error.message}`);
			return { result: 'deny' }; // NanoMQ precisa de HTTP 200 com result deny ou HTTP 401
		}
	}

	@Post('acl')
	@HttpCode(200)
	async authorizeAcl(
		@Body() body: {
			clientid: string;
			username?: string;
			password?: string;
			access?: string;
			action?: string;
			topic: string;
		},
	) {
		const actionStr = body.access || body.action;
		this.logger.debug(`MQTT ACL Request: ${actionStr} on ${body.topic}`);

		// 1. Internal Services tem acesso total
		if (body.username === 'internal-system') {
			return { result: 'allow' };
		}

		// 2. Extrair o userId a partir do username
		// Como o broker NanoMQ/EMQX NÃO envia o password no payload de ACL por padrão,
		// nós validamos no 'connect' que o username é igual ao ID do usuário no JWT.
		if (!body.username) {
			return { result: 'deny' };
		}
		const userId = body.username;

		const action = actionStr; // "1" = subscribe, "2" = publish, "3" = pubsub (NanoMQ) or "subscribe"/"publish" (EMQX)

		const isPublish =
			action === '2' || action === '3' || action === 'publish';

		// REGRA 1: Clients externos SÓ podem fazer SUBSCRIBE, nunca PUBLISH direto.
		// (Publish sempre deve passar pelas APIs HTTP do NestJS)
		if (isPublish) {
			return { result: 'deny' };
		}

		// REGRA 2: Acesso ao tópico de Notificações Pessoais
		// Tópico: users/{userId}/notifications
		if (body.topic.startsWith('users/')) {
			// Verifica se o tópico pertence estritamente ao usuário autenticado
			if (body.topic.includes(`users/${userId}/`)) {
				return { result: 'allow' };
			}
			return { result: 'deny' }; // Tentativa de espionar outro usuário
		}

		// REGRA 3: Acesso aos tópicos públicos/livros
		// Tópicos: books/events/book/{bookId}, books/events/chapter/{chapterId}, etc.
		if (body.topic.startsWith('books/events/')) {
			return { result: 'allow' };
		}

		// Se não caiu em nenhuma regra permitida, nega por padrão (Deny by Default)
		return { result: 'deny' };
	}
}
