import { TransformFnParams } from 'class-transformer';
import { CoverBookDto } from '../cover-book.dto';

export function transformCoverBookLegacyFormat({ value }: TransformFnParams): CoverBookDto | undefined {
    if (!value || value.urlImgs !== undefined) {
        return value;
    }

    if (value.urlImg && typeof value.urlImg === 'string') {
        return CoverBookDto.fromLegacyFormat({
            urlImg: value.urlImg,
            urlOrigin: value.urlOrigin,
        });
    }

    return value;
}
