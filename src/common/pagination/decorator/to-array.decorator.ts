import { Transform } from 'class-transformer';

export function ToArray() {
	return Transform(({ value }: { value: unknown }) => {
		if (Array.isArray(value)) return value as unknown[];
		if (value !== undefined && value !== null) return [value];
		return [];
	});
}
