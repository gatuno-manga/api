import { CreateBookDto } from './create-book.dto';
import { OmitType, PartialType } from '@nestjs/mapped-types';

export class UpdateBookDto extends PartialType(
	OmitType(CreateBookDto, ['chapters', 'validator'] as const),
) {}
