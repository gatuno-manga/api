import { ConsoleLogger, Logger } from '@nestjs/common';

const shouldShowLogs = process.env.TEST_LOGS === 'true';

if (!shouldShowLogs) {
	Logger.overrideLogger(false);

	const noop = () => undefined;

	jest.spyOn(Logger, 'log').mockImplementation(noop);
	jest.spyOn(Logger, 'error').mockImplementation(noop);
	jest.spyOn(Logger, 'warn').mockImplementation(noop);
	jest.spyOn(Logger, 'debug').mockImplementation(noop);
	jest.spyOn(Logger, 'verbose').mockImplementation(noop);

	jest.spyOn(ConsoleLogger.prototype, 'log').mockImplementation(noop);
	jest.spyOn(ConsoleLogger.prototype, 'error').mockImplementation(noop);
	jest.spyOn(ConsoleLogger.prototype, 'warn').mockImplementation(noop);
	jest.spyOn(ConsoleLogger.prototype, 'debug').mockImplementation(noop);
	jest.spyOn(ConsoleLogger.prototype, 'verbose').mockImplementation(noop);

	jest.spyOn(console, 'log').mockImplementation(noop);
	jest.spyOn(console, 'info').mockImplementation(noop);
	jest.spyOn(console, 'warn').mockImplementation(noop);
	jest.spyOn(console, 'error').mockImplementation(noop);
	jest.spyOn(console, 'debug').mockImplementation(noop);
}
