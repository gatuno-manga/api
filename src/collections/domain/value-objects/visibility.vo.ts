import { CollectionVisibility } from '@/collections/domain/enums/collection-visibility.enum';

export class Visibility {
	private constructor(private readonly value: CollectionVisibility) {}

	public static create(value: string | CollectionVisibility): Visibility {
		const visibility = value as CollectionVisibility;
		if (!Object.values(CollectionVisibility).includes(visibility)) {
			throw new Error(`Invalid visibility status: ${value}`);
		}
		return new Visibility(visibility);
	}

	public static private(): Visibility {
		return new Visibility(CollectionVisibility.PRIVATE);
	}

	public static public(): Visibility {
		return new Visibility(CollectionVisibility.PUBLIC);
	}

	public static shared(): Visibility {
		return new Visibility(CollectionVisibility.SHARED);
	}

	public isPublic(): boolean {
		return this.value === CollectionVisibility.PUBLIC;
	}

	public isPrivate(): boolean {
		return this.value === CollectionVisibility.PRIVATE;
	}

	public isShared(): boolean {
		return this.value === CollectionVisibility.SHARED;
	}

	public toString(): string {
		return this.value;
	}

	public equals(other: Visibility): boolean {
		return this.value === other.toString();
	}
}
