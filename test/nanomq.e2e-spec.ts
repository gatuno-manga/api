import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '@/app.module';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BookEvents } from '@books/domain/constants/events.constant';
import { MqttTopics } from '@common/domain/constants/mqtt-topics.constant';
import * as mqtt from 'mqtt';

describe('NanoMQ Integration (e2e)', () => {
	let app: INestApplication;
	let eventEmitter: EventEmitter2;
	let mqttClient: mqtt.MqttClient;

	const mqttUrl = `mqtt://${process.env.NANOMQ_HOST || 'localhost'}:${process.env.NANOMQ_PORT || 1883}`;

	beforeAll(async () => {
		const moduleFixture: TestingModule = await Test.createTestingModule({
			imports: [AppModule],
		}).compile();

		app = moduleFixture.createNestApplication();
		await app.init();

		eventEmitter = app.get(EventEmitter2);

		// Connect a test client to NanoMQ
		mqttClient = mqtt.connect(mqttUrl, {
			connectTimeout: 2000,
			reconnectPeriod: 0, // Don't reconnect if it fails initially
		});

		await new Promise<void>((resolve, reject) => {
			const timeout = setTimeout(() => {
				mqttClient.end();
				reject(new Error('Failed to connect to NanoMQ for E2E tests'));
			}, 3000);

			mqttClient.on('connect', () => {
				clearTimeout(timeout);
				resolve();
			});

			mqttClient.on('error', (err) => {
				clearTimeout(timeout);
				reject(err);
			});
		}).catch((err) => {
			console.warn(`Skipping NanoMQ E2E tests: ${err.message}`);
		});
	});

	afterAll(async () => {
		if (mqttClient?.connected) {
			mqttClient.end();
		}
		await app?.close();
	});

	it('should publish book creation events to NanoMQ', async () => {
		if (!mqttClient?.connected) {
			console.warn('NanoMQ not connected, skipping test');
			return;
		}

		const testBook = {
			id: 'e2e-book-1',
			title: 'E2E Test Book',
			type: 'MANGA',
			createdAt: new Date(),
		};

		const messagePromise = new Promise<{ event: string; payload: any }>(
			(resolve) => {
				mqttClient.subscribe(MqttTopics.BOOKS.ADMIN);
				mqttClient.on('message', (topic, message) => {
					if (topic === MqttTopics.BOOKS.ADMIN) {
						resolve(JSON.parse(message.toString()));
					}
				});
			},
		);

		// Trigger the domain event
		eventEmitter.emit(BookEvents.CREATED, testBook);

		const received = await messagePromise;

		expect(received.event).toBe(BookEvents.CREATED);
		expect(received.payload.id).toBe(testBook.id);
		expect(received.payload.title).toBe(testBook.title);
	});

	it('should publish reading progress updates to NanoMQ', async () => {
		if (!mqttClient?.connected) {
			console.warn('NanoMQ not connected, skipping test');
			return;
		}

		const userId = 'e2e-user-1';
		const progressData = {
			userId,
			progress: {
				chapterId: 'e2e-ch-1',
				bookId: 'e2e-bk-1',
				pageIndex: 10,
				updatedAt: new Date(),
			},
		};

		const topic = MqttTopics.USERS.READING_PROGRESS(userId);
		const messagePromise = new Promise<{ event: string; payload: any }>(
			(resolve) => {
				mqttClient.subscribe(topic);
				mqttClient.on('message', (t, message) => {
					if (t === topic) {
						resolve(JSON.parse(message.toString()));
					}
				});
			},
		);

		// Trigger the reading progress updated event
		// Using the same event name as in ReadingEvents.UPDATED
		eventEmitter.emit('reading.progress.updated', progressData);

		const received = await messagePromise;

		expect(received.event).toBe('progress:synced');
		expect(received.payload.chapterId).toBe(
			progressData.progress.chapterId,
		);
		expect(received.payload.pageIndex).toBe(
			progressData.progress.pageIndex,
		);
	});
});
