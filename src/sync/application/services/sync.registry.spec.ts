import { InternalServerErrorException } from '@nestjs/common';
import { SyncFeature } from '../types/sync-feature.enum';
import { ISyncProvider } from '../types/sync-provider.interface';
import { SyncRegistry } from './sync.registry';

describe('SyncRegistry', () => {
	let registry: SyncRegistry;

	beforeEach(() => {
		registry = new SyncRegistry();
	});

	it('should register a provider successfully', () => {
		const mockProvider: ISyncProvider = {
			getFeatureName: jest
				.fn()
				.mockReturnValue(SyncFeature.READING_PROGRESS),
			pull: jest.fn(),
			push: jest.fn(),
		};

		registry.register(mockProvider);

		expect(registry.getProvider(SyncFeature.READING_PROGRESS)).toBe(
			mockProvider,
		);
	});

	it('should overwrite if the provider is already registered', () => {
		const mockProvider1: ISyncProvider = {
			getFeatureName: jest
				.fn()
				.mockReturnValue(SyncFeature.READING_PROGRESS),
			pull: jest.fn(),
			push: jest.fn(),
		};

		const mockProvider2: ISyncProvider = {
			getFeatureName: jest
				.fn()
				.mockReturnValue(SyncFeature.READING_PROGRESS),
			pull: jest.fn(),
			push: jest.fn(),
		};

		registry.register(mockProvider1);
		registry.register(mockProvider2);

		expect(registry.getProvider(SyncFeature.READING_PROGRESS)).toBe(
			mockProvider2,
		);
	});

	it('should return undefined if getting a non-registered provider', () => {
		expect(
			registry.getProvider(SyncFeature.READING_PROGRESS),
		).toBeUndefined();
	});
});
