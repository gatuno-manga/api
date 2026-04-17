import { LogLevel } from '../common/types/logging.types';

export interface LogRule {
	contexts: string[];
	level: LogLevel;
}

export class LoggerRuleEngine {
	private readonly contextRules: Map<string, number> = new Map();
	private readonly DEFAULT_CONTEXT = '*';
	private readonly DEFAULT_LEVEL: LogLevel = 'info';

	private readonly LOG_LEVEL_MAP: Readonly<Record<LogLevel, number>> = {
		trace: 0,
		debug: 1,
		info: 2,
		warn: 3,
		error: 4,
	};

	constructor(rulesString?: string) {
		this.initializeRules(rulesString);
	}

	public shouldLog(methodLevel: LogLevel, context?: string): boolean {
		const methodLevelNum = this.LOG_LEVEL_MAP[methodLevel];
		const configuredLevelNum = this.getLogLevelForContext(context);

		return methodLevelNum >= configuredLevelNum;
	}

	private getLogLevelForContext(context?: string): number {
		const ctx = context || this.DEFAULT_CONTEXT;

		const contextLevel = this.contextRules.get(ctx);
		if (contextLevel !== undefined) {
			return contextLevel;
		}

		return (
			this.contextRules.get(this.DEFAULT_CONTEXT) ??
			this.LOG_LEVEL_MAP[this.DEFAULT_LEVEL]
		);
	}

	private initializeRules(rules?: string): void {
		if (!rules?.trim()) {
			this.setDefaultRule();
			return;
		}

		const ruleEntries = rules.split('/').filter(Boolean);

		for (const rule of ruleEntries) {
			const parsedRule = this.parseRule(rule.trim());
			if (!parsedRule) continue;

			const numericLevel =
				this.LOG_LEVEL_MAP[parsedRule.level] ??
				this.LOG_LEVEL_MAP[this.DEFAULT_LEVEL];

			for (const context of parsedRule.contexts) {
				this.contextRules.set(context.trim(), numericLevel);
			}
		}

		if (!this.contextRules.has(this.DEFAULT_CONTEXT)) {
			this.setDefaultRule();
		}
	}

	private setDefaultRule(): void {
		this.contextRules.set(
			this.DEFAULT_CONTEXT,
			this.LOG_LEVEL_MAP[this.DEFAULT_LEVEL],
		);
	}

	private parseRule(
		rule: string,
	): { contexts: string[]; level: LogLevel } | null {
		try {
			let contextPart = this.DEFAULT_CONTEXT;
			let levelPart = this.DEFAULT_LEVEL;

			const parts = rule.split(';').filter(Boolean);

			for (const part of parts) {
				const trimmedPart = part.trim();

				if (trimmedPart.startsWith('context=')) {
					contextPart = trimmedPart.slice(8) || this.DEFAULT_CONTEXT;
				} else if (trimmedPart.startsWith('level=')) {
					const extractedLevel = trimmedPart.slice(6);
					if (this.isLogLevel(extractedLevel)) {
						levelPart = extractedLevel;
					}
				}
			}

			const contexts = contextPart
				.split(',')
				.map((c) => c.trim())
				.filter(Boolean);

			return {
				contexts:
					contexts.length > 0 ? contexts : [this.DEFAULT_CONTEXT],
				level: levelPart,
			};
		} catch {
			return null;
		}
	}

	private isLogLevel(value: string): value is LogLevel {
		return value in this.LOG_LEVEL_MAP;
	}
}
