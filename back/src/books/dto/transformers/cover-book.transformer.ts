import { TransformFnParams } from 'class-transformer';
import { CoverBookDto } from '../cover-book.dto';

interface LegacyCoverBook {
	urlImg?: string;
	urlOrigin?: string;
	urlImgs?: unknown;
}

export function transformCoverBookLegacyFormat({
	value,
}: TransformFnParams): CoverBookDto | undefined {
	const val = value as LegacyCoverBook | undefined;

	if (!val || val.urlImgs !== undefined) {
		return value as CoverBookDto | undefined;
	}

	if (val.urlImg && typeof val.urlImg === 'string') {
		return CoverBookDto.fromLegacyFormat({
			urlImg: val.urlImg,
			urlOrigin: val.urlOrigin,
		});
	}

	return value as CoverBookDto | undefined;
}
