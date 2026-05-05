import { Test, TestingModule } from '@nestjs/testing';
import { ClientProxy } from '@nestjs/microservices';
import { of } from 'rxjs';
import { ReadingProgressNotifier } from './reading-progress.notifier';
import { ReadingEvents } from '@users/domain/constants/events.constant';
import { MqttTopics } from '@common/domain/constants/mqtt-topics.constant';

describe('ReadingProgressNotifier', () => {
	let notifier: ReadingProgressNotifier;
	let mqttClient: jest.Mocked<ClientProxy>;

	beforeEach(async () => {
		const mockMqttClient = {
			emit: jest.fn().mockReturnValue(of({})),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				ReadingProgressNotifier,
				{
					provide: 'MQTT_CLIENT',
					useValue: mockMqttClient,
				},
			],
		}).compile();

		notifier = module.get<ReadingProgressNotifier>(ReadingProgressNotifier);
		mqttClient = module.get('MQTT_CLIENT');
	});

	it('should be defined', () => {
		expect(notifier).toBeDefined();
	});

	describe('handleProgressUpdatedEvent', () => {
		it('should publish progress synced event to user topic', () => {
			const payload = {
				userId: 'user-1',
				progress: {
					chapterId: 'ch-1',
					bookId: 'bk-1',
					pageIndex: 5,
					updatedAt: new Date(),
				} as any,
			};

			notifier.handleProgressUpdatedEvent(payload);

			expect(mqttClient.emit).toHaveBeenCalledWith(
				MqttTopics.USERS.READING_PROGRESS(payload.userId),
				{
					event: 'progress:synced',
					payload: payload.progress,
				},
			);
		});
	});

	describe('handleProgressDeletedEvent', () => {
		it('should publish progress deleted event to user topic', () => {
			const payload = {
				userId: 'user-1',
				chapterId: 'ch-1',
			};

			notifier.handleProgressDeletedEvent(payload);

			expect(mqttClient.emit).toHaveBeenCalledWith(
				MqttTopics.USERS.READING_PROGRESS(payload.userId),
				{
					event: 'progress:deleted',
					payload: { chapterId: payload.chapterId },
				},
			);
		});
	});

	describe('handleBookProgressDeletedEvent', () => {
		it('should publish book progress deleted event to user topic', () => {
			const payload = {
				userId: 'user-1',
				bookId: 'bk-1',
			};

			notifier.handleBookProgressDeletedEvent(payload);

			expect(mqttClient.emit).toHaveBeenCalledWith(
				MqttTopics.USERS.READING_PROGRESS(payload.userId),
				{
					event: 'progress:book:deleted',
					payload: { bookId: payload.bookId },
				},
			);
		});
	});
});
