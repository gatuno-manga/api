import { LoggerRuleEngine } from './logger-rule-engine';
import { LogLevel } from '@common/types/logging.types';

describe('LoggerRuleEngine', () => {
	describe('Simple Rule Parsing', () => {
		it('should support simple global level: debug', () => {
			const engine = new LoggerRuleEngine('debug');
			expect(engine.shouldLog('debug')).toBe(true);
			expect(engine.shouldLog('info')).toBe(true);
			expect(engine.shouldLog('trace')).toBe(false);
		});

		it('should support simple global level: trace', () => {
			const engine = new LoggerRuleEngine('trace');
			expect(engine.shouldLog('trace')).toBe(true);
			expect(engine.shouldLog('debug')).toBe(true);
		});

		it('should support simple global level: warn', () => {
			const engine = new LoggerRuleEngine('warn');
			expect(engine.shouldLog('warn')).toBe(true);
			expect(engine.shouldLog('info')).toBe(false);
			expect(engine.shouldLog('error')).toBe(true);
		});
	});

	describe('Complex Rule Parsing', () => {
		it('should support context-specific rules', () => {
			const engine = new LoggerRuleEngine('context=AuthService;level=debug/context=*;level=info');
			
			// AuthService context
			expect(engine.shouldLog('debug', 'AuthService')).toBe(true);
			expect(engine.shouldLog('trace', 'AuthService')).toBe(false);

			// Other contexts
			expect(engine.shouldLog('debug', 'OtherService')).toBe(false);
			expect(engine.shouldLog('info', 'OtherService')).toBe(true);
		});

		it('should support multiple contexts in one rule', () => {
			const engine = new LoggerRuleEngine('context=AuthService,UsersModule;level=trace/context=*;level=error');
			
			expect(engine.shouldLog('trace', 'AuthService')).toBe(true);
			expect(engine.shouldLog('trace', 'UsersModule')).toBe(true);
			expect(engine.shouldLog('warn', 'Other')).toBe(false);
			expect(engine.shouldLog('error', 'Other')).toBe(true);
		});
	});

	describe('Defaults and Edge Cases', () => {
		it('should fallback to info when rules are empty', () => {
			const engine = new LoggerRuleEngine('');
			expect(engine.shouldLog('info')).toBe(true);
			expect(engine.shouldLog('debug')).toBe(false);
		});

		it('should fallback to info when rules are invalid', () => {
			const engine = new LoggerRuleEngine('invalid-rule-format');
			expect(engine.shouldLog('info')).toBe(true);
			expect(engine.shouldLog('debug')).toBe(false);
		});

		it('should handle missing level in complex rule by defaulting to info', () => {
			const engine = new LoggerRuleEngine('context=AuthService');
			expect(engine.shouldLog('info', 'AuthService')).toBe(true);
			expect(engine.shouldLog('debug', 'AuthService')).toBe(false);
		});
	});

	describe('Sampling', () => {
		it('should apply sampling only to level info and below', () => {
			// Sampling rate 0 ensures info/debug/trace are dropped
			const engine = new LoggerRuleEngine('trace', 0);
			
			expect(engine.shouldLog('trace')).toBe(false);
			expect(engine.shouldLog('debug')).toBe(false);
			expect(engine.shouldLog('info')).toBe(false);
			
			// warn/error should NEVER be sampled
			expect(engine.shouldLog('warn')).toBe(true);
			expect(engine.shouldLog('error')).toBe(true);
		});

		it('should allow all logs when sampling is 1.0', () => {
			const engine = new LoggerRuleEngine('trace', 1.0);
			expect(engine.shouldLog('trace')).toBe(true);
			expect(engine.shouldLog('info')).toBe(true);
		});
	});
});
