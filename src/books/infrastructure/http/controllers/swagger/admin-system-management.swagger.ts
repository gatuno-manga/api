import { applyDecorators } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';

export function ApiDocsListCronJobs() {
	return applyDecorators(
		ApiOperation({ summary: 'List all registered cron jobs' }),
	);
}

export function ApiDocsStopCronJob() {
	return applyDecorators(
		ApiOperation({ summary: 'Stop a specific cron job' }),
	);
}

export function ApiDocsStartCronJob() {
	return applyDecorators(
		ApiOperation({ summary: 'Start a specific cron job' }),
	);
}

export function ApiDocsListQueues() {
	return applyDecorators(
		ApiOperation({ summary: 'List all managed queues' }),
	);
}

export function ApiDocsPauseQueue() {
	return applyDecorators(ApiOperation({ summary: 'Pause a specific queue' }));
}

export function ApiDocsResumeQueue() {
	return applyDecorators(
		ApiOperation({ summary: 'Resume a specific queue' }),
	);
}

export function ApiDocsResetAutoPause() {
	return applyDecorators(
		ApiOperation({
			summary: 'Reset the auto-pause failure counter for a queue',
		}),
	);
}
