import { Transform } from 'class-transformer';

export function ToArray() {
	return Transform(({ value }) =>
		Array.isArray(value) ? value : value ? [value] : [],
	);
}
