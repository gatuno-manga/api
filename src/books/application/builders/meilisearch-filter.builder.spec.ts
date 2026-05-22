import { BookPageOptionsDto } from '@books/application/dto/book-page-options.dto';
import { AccessContext } from '@books/domain/types/criteria.types';
import { MeilisearchFilterBuilder } from './meilisearch-filter.builder';

describe('MeilisearchFilterBuilder', () => {
	it('should build a simple filter with type', () => {
		const options = new BookPageOptionsDto();
		options.type = ['manga'] as any; // Simplified for test
		const accessContext: AccessContext = {
			effectiveMaxWeightSensitiveContent: 0,
		};

		const filter = MeilisearchFilterBuilder.build(options, accessContext);
		expect(filter).toContain('type = "manga"');
	});

	it('should combine multiple user filters with security context', () => {
		const options = new BookPageOptionsDto();
		options.sites = ['hiper.cool', 'manganato.com'];
		options.tags = ['tag-1', 'tag-2'];

		const accessContext: AccessContext = {
			effectiveMaxWeightSensitiveContent: 2,
			denyTagIds: ['forbidden-tag'],
		};

		const filter = MeilisearchFilterBuilder.build(options, accessContext);

		expect(filter).toContain(
			'(sites = "hiper.cool" OR sites = "manganato.com")',
		);
		expect(filter).toContain('(tagIds = "tag-1" AND tagIds = "tag-2")');
		expect(filter).toContain('maxSensitiveWeight <= 2');
		expect(filter).toContain('(tagIds != "forbidden-tag")');
	});

	it('should handle blockedAll state', () => {
		const options = new BookPageOptionsDto();
		const accessContext: AccessContext = {
			blockedAll: true,
			effectiveMaxWeightSensitiveContent: 0,
		};

		const filter = MeilisearchFilterBuilder.build(options, accessContext);
		expect(filter).toBe('id = "__NONE__"');
	});

	it('should handle complex security exclusions', () => {
		const options = new BookPageOptionsDto();
		const accessContext: AccessContext = {
			effectiveMaxWeightSensitiveContent: 5,
			denyBookIds: ['book-1', 'book-2'],
			denySensitiveContentIds: ['sc-1'],
		};

		const filter = MeilisearchFilterBuilder.build(options, accessContext);

		expect(filter).toContain('maxSensitiveWeight <= 5');
		expect(filter).toContain('(id != "book-1" AND id != "book-2")');
		expect(filter).toContain('(sensitiveContentIds != "sc-1")');
	});
});
