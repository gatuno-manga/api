import { AppConfigService } from '@/infrastructure/app-config/app-config.service';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as webpush from 'web-push';
import { WebPushSubscription } from '../database/entities/web-push-subscription.entity';
import { WebPushSubscriptionDto } from '../http/dto/web-push.dto';

export interface PushNotificationPayload {
	title: string;
	body: string;
	url?: string;
	icon?: string;
	badge?: string;
	image?: string;
	vibrate?: number[];
	data?: Record<string, unknown>;
	actions?: Array<{ action: string; title: string }>;
}

@Injectable()
export class WebPushService implements OnModuleInit {
	private readonly logger = new Logger(WebPushService.name);

	constructor(
		private readonly appConfigService: AppConfigService,
		@InjectRepository(WebPushSubscription)
		private readonly subscriptionRepository: Repository<WebPushSubscription>,
	) {}

	onModuleInit() {
		const publicKey = this.appConfigService.webPush.vapidPublicKey;
		const privateKey = this.appConfigService.webPush.vapidPrivateKey;
		const subject = this.appConfigService.webPush.vapidSubject;

		if (publicKey && privateKey && subject) {
			webpush.setVapidDetails(subject, publicKey, privateKey);
			this.logger.log('VAPID keys configured successfully.');
		} else {
			this.logger.warn(
				'VAPID keys are missing from environment variables! Web Push will not work.',
			);
		}
	}

	getPublicKey(): string {
		const key = this.appConfigService.webPush.vapidPublicKey;
		if (!key) throw new Error('VAPID_PUBLIC_KEY is not defined');
		return key;
	}

	async saveSubscription(
		userId: string,
		dto: WebPushSubscriptionDto,
	): Promise<void> {
		const existing = await this.subscriptionRepository.findOne({
			where: { userId, endpoint: dto.endpoint },
		});

		if (existing) {
			existing.p256dh = dto.keys.p256dh;
			existing.auth = dto.keys.auth;
			existing.deviceAgent = dto.deviceAgent ?? null;
			await this.subscriptionRepository.save(existing);
			return;
		}

		const subscription = this.subscriptionRepository.create({
			userId,
			endpoint: dto.endpoint,
			p256dh: dto.keys.p256dh,
			auth: dto.keys.auth,
			deviceAgent: dto.deviceAgent ?? null,
		});

		await this.subscriptionRepository.save(subscription);
	}

	async deleteSubscription(userId: string, endpoint: string): Promise<void> {
		await this.subscriptionRepository.delete({ userId, endpoint });
	}

	async notifyUser(
		userId: string,
		payload: PushNotificationPayload,
	): Promise<void> {
		const subscriptions = await this.subscriptionRepository.find({
			where: { userId },
		});

		if (subscriptions.length === 0) return;

		const finalPayload = {
			icon: payload.icon || this.appConfigService.webPush.defaultIcon,
			badge: payload.badge || this.appConfigService.webPush.defaultBadge,
			vibrate: payload.vibrate || [100, 50, 100],
			...payload,
			data: {
				url: payload.url, // Keep backward compatibility for frontend routing
				...payload.data,
			},
		};

		const notificationPayload = JSON.stringify(finalPayload);

		const sendPromises = subscriptions.map(async (sub) => {
			try {
				await webpush.sendNotification(
					{
						endpoint: sub.endpoint,
						keys: {
							p256dh: sub.p256dh,
							auth: sub.auth,
						},
					},
					notificationPayload,
				);
			} catch (error: unknown) {
				if (error instanceof webpush.WebPushError) {
					if (error.statusCode === 410 || error.statusCode === 404) {
						this.logger.log(
							`Subscription ${sub.id} is dead. Removing from DB.`,
						);
						await this.subscriptionRepository.delete(sub.id);
					} else {
						this.logger.error(
							`Error sending push to ${sub.endpoint}: ${error.message}`,
						);
					}
				} else if (error instanceof Error) {
					this.logger.error(
						`Error sending push to ${sub.endpoint}: ${error.message}`,
					);
				} else {
					this.logger.error(
						`Unknown error sending push to ${sub.endpoint}: ${String(error)}`,
					);
				}
			}
		});

		await Promise.allSettled(sendPromises);
	}
}
