import { validate } from 'class-validator';
import { BookChaptersCursorOptionsDto } from '../dto/book-chapters-cursor-options.dto';
import { OrderDirection } from 'src/common/enum/order-direction.enum';

describe('BookChaptersCursorOptionsDto', () => {
	it('should pass validation with valid data', async () => {
		const dto = new BookChaptersCursorOptionsDto();
		dto.order = OrderDirection.ASC;
		dto.limit = 200;

		const errors = await validate(dto);
		expect(errors.length).toBe(0);
	});

	it('should fail validation with invalid order direction', async () => {
		const dto = new BookChaptersCursorOptionsDto();
		(dto as any).order = 'invalid_direction';

		const errors = await validate(dto);
		expect(errors.length).toBeGreaterThan(0);
		expect(errors[0].property).toBe('order');
	});

	it('should fail validation with out of range limit', async () => {
		const dto = new BookChaptersCursorOptionsDto();
		dto.limit = 600;

		const errors = await validate(dto);
		expect(errors.length).toBeGreaterThan(0);
		expect(errors[0].property).toBe('limit');
	});
});
