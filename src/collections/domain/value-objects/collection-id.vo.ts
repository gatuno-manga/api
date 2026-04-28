import { Uuid } from '../../../common/domain/value-objects/uuid.vo';

export class CollectionId extends Uuid {
	public static create(value: string): CollectionId {
		return new CollectionId(value);
	}

	public static generate(): CollectionId {
		return new CollectionId(Uuid.generateValue());
	}
}
