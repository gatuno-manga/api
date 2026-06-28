import { CurrentUser } from '@auth/infrastructure/framework/current-user.decorator';
import { JwtAuthGuard } from '@auth/infrastructure/framework/jwt-auth.guard';
import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	Post,
	Query,
	UseGuards,
} from '@nestjs/common';
import { UserSnapshot } from '@users/domain/entities/user';
import { WebPushService } from '../../web-push/web-push.service';
import { WebPushSubscriptionDto } from '../dto/web-push.dto';

@Controller('notifications/push')
export class WebPushController {
	constructor(private readonly webPushService: WebPushService) {}

	@Get('vapid-key')
	getVapidKey() {
		return { publicKey: this.webPushService.getPublicKey() };
	}

	@Post('subscribe')
	@UseGuards(JwtAuthGuard)
	@HttpCode(200)
	async subscribe(
		@CurrentUser() user: UserSnapshot,
		@Body() dto: WebPushSubscriptionDto,
	) {
		await this.webPushService.saveSubscription(user.id, dto);
		return { success: true };
	}

	@Delete('unsubscribe')
	@UseGuards(JwtAuthGuard)
	@HttpCode(200)
	async unsubscribe(
		@CurrentUser() user: UserSnapshot,
		@Query('endpoint') endpoint: string,
	) {
		if (!endpoint) {
			return { success: false, message: 'Endpoint is required' };
		}
		await this.webPushService.deleteSubscription(user.id, endpoint);
		return { success: true };
	}
}
