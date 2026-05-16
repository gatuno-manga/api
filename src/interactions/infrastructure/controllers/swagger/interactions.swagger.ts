import { applyDecorators } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';

export function ApiDocsFavorite() {
	return applyDecorators(ApiOperation({ summary: 'Mark book as favorite' }));
}

export function ApiDocsSubscribe() {
	return applyDecorators(
		ApiOperation({ summary: 'Subscribe to book updates' }),
	);
}

export function ApiDocsReview() {
	return applyDecorators(ApiOperation({ summary: 'Review and rate a book' }));
}
