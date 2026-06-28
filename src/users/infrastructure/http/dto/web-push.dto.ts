import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class WebPushKeysDto {
	@IsString()
	@IsNotEmpty()
	p256dh: string;

	@IsString()
	@IsNotEmpty()
	auth: string;
}

export class WebPushSubscriptionDto {
	@IsString()
	@IsNotEmpty()
	endpoint: string;

	@IsObject()
	@IsNotEmpty()
	keys: WebPushKeysDto;

	@IsString()
	@IsOptional()
	deviceAgent?: string;
}
