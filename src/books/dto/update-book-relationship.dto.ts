import { PartialType } from '@nestjs/swagger';
import { OmitType } from '@nestjs/swagger';
import { CreateBookRelationshipDto } from './create-book-relationship.dto';

export class UpdateBookRelationshipDto extends PartialType(
	OmitType(CreateBookRelationshipDto, ['targetBookId'] as const),
) {}
