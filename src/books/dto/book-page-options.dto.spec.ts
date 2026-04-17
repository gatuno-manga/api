import { validate } from 'class-validator';
import { BookPageOptionsDto } from '../dto/book-page-options.dto';
import { BookOrderField } from '../enum/book-order-field.enum';
import { OrderDirection } from 'src/common/enum/order-direction.enum';
import { FilterLogic } from 'src/common/enum/filter-logic.enum';
import { FilterOperator } from 'src/common/enum/filter-operator.enum';

describe('BookPageOptionsDto', () => {
	it('should pass validation with valid data', async () => {
		const dto = new BookPageOptionsDto();
		dto.orderBy = BookOrderField.TITLE;
		dto.order = OrderDirection.ASC;
		dto.tagsLogic = FilterLogic.AND;
		dto.publicationOperator = FilterOperator.EQ;

		const errors = await validate(dto);
		expect(errors.length).toBe(0);
	});

	it('should fail validation with invalid order field', async () => {
		const dto = new BookPageOptionsDto();
		(dto as any).orderBy = 'invalid_field';

		const errors = await validate(dto);
		expect(errors.length).toBeGreaterThan(0);
		expect(errors[0].property).toBe('orderBy');
	});

	it('should fail validation with invalid order direction', async () => {
		const dto = new BookPageOptionsDto();
		(dto as any).order = 'invalid_direction';

		const errors = await validate(dto);
		expect(errors.length).toBeGreaterThan(0);
		expect(errors[0].property).toBe('order');
	});

	it('should fail validation with invalid tags logic', async () => {
		const dto = new BookPageOptionsDto();
		(dto as any).tagsLogic = 'invalid_logic';

		const errors = await validate(dto);
		expect(errors.length).toBeGreaterThan(0);
		expect(errors[0].property).toBe('tagsLogic');
	});

	it('should fail validation with invalid publication operator', async () => {
		const dto = new BookPageOptionsDto();
		(dto as any).publicationOperator = 'invalid_operator';

		const errors = await validate(dto);
		expect(errors.length).toBeGreaterThan(0);
		expect(errors[0].property).toBe('publicationOperator');
	});
});
