import { Test, TestingModule } from '@nestjs/testing';
import { PinoLogger } from 'nestjs-pino';
import { CustomLogger } from './custom.logger';
import { AppConfigService } from './infrastructure/app-config/app-config.service';
import { LoggerRuleEngine } from './infrastructure/logging/logger-rule-engine';

describe('CustomLogger', () => {
	let customLogger: CustomLogger;
	let pinoLogger: jest.Mocked<PinoLogger>;
	let engine: LoggerRuleEngine;

	beforeEach(async () => {
		pinoLogger = {
			trace: jest.fn(),
			debug: jest.fn(),
			info: jest.fn(),
			warn: jest.fn(),
			error: jest.fn(),
			setContext: jest.fn(),
		} as any;

		const configService = {
			logLevel: 'info',
			logSamplingRate: 1.0,
		} as AppConfigService;

		engine = new LoggerRuleEngine('info');

		// Manually instantiate to bypass @InjectPinoLogger() token issues in tests
		customLogger = new CustomLogger(configService, pinoLogger, engine);
	});

	it('should log info when LOG_LEVEL is info', () => {
		customLogger.log('test info');
		expect(pinoLogger.info).toHaveBeenCalled();
	});

	it('should NOT log debug when LOG_LEVEL is info', () => {
		customLogger.debug('test debug');
		expect(pinoLogger.debug).not.toHaveBeenCalled();
	});

	it('should log debug when engine allows it', () => {
		// Simulate dynamic rule change
		(customLogger as any).engine = new LoggerRuleEngine('debug');
		customLogger.debug('test debug');
		expect(pinoLogger.debug).toHaveBeenCalled();
	});

	it('should log warn regardless of info level', () => {
		customLogger.warn('test warn');
		expect(pinoLogger.warn).toHaveBeenCalled();
	});

	it('should respect context-specific rules', () => {
		(customLogger as any).engine = new LoggerRuleEngine(
			'context=Auth;level=debug/context=*;level=info',
		);

		customLogger.setContext('Auth');
		customLogger.debug('auth debug');
		expect(pinoLogger.debug).toHaveBeenCalled();

		pinoLogger.debug.mockClear();

		customLogger.setContext('Other');
		customLogger.debug('other debug');
		expect(pinoLogger.debug).not.toHaveBeenCalled();
	});
});
