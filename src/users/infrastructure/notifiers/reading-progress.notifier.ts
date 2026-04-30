import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ClientProxy } from '@nestjs/microservices';
import { ReadingEvents } from '../../domain/constants/events.constant';
import { ReadingProgressResponseDto } from '../http/dto/reading-progress.dto';
import { MqttTopics } from '../../../common/domain/constants/mqtt-topics.constant';

interface ProgressUpdatePayload {
	userId: string;
	progress: ReadingProgressResponseDto;
}

interface ProgressDeletePayload {
	userId: string;
	chapterId: string;
}

interface BookProgressDeletePayload {
	userId: string;
	bookId: string;
}

@Injectable()
export class ReadingProgressNotifier {
	private readonly logger = new Logger(ReadingProgressNotifier.name);

	constructor(
		@Inject('MQTT_CLIENT')
		private readonly mqttClient: ClientProxy,
	) {}

	private publish(topic: string, event: string, payload: unknown) {
		this.mqttClient.emit(topic, { event, payload }).subscribe({
			error: (err) => {
				this.logger.error(
					`Failed to publish to ${topic}: ${err.message}`,
				);
			},
		});
	}

	/**
	 * Propaga atualização de progresso para todos os dispositivos do usuário via MQTT
	 */
	@OnEvent(ReadingEvents.UPDATED)
	handleProgressUpdatedEvent(payload: ProgressUpdatePayload) {
		this.publish(
			MqttTopics.USERS.READING_PROGRESS(payload.userId),
			'progress:synced',
			payload.progress,
		);
	}

	/**
	 * Propaga deleção de progresso para todos os dispositivos do usuário via MQTT
	 */
	@OnEvent(ReadingEvents.DELETED)
	handleProgressDeletedEvent(payload: ProgressDeletePayload) {
		this.publish(
			MqttTopics.USERS.READING_PROGRESS(payload.userId),
			'progress:deleted',
			{ chapterId: payload.chapterId },
		);
	}

	/**
	 * Propaga deleção de progresso de um livro para todos os dispositivos via MQTT
	 */
	@OnEvent(ReadingEvents.BOOK_DELETED)
	handleBookProgressDeletedEvent(payload: BookProgressDeletePayload) {
		this.publish(
			MqttTopics.USERS.READING_PROGRESS(payload.userId),
			'progress:book:deleted',
			{ bookId: payload.bookId },
		);
	}
}
