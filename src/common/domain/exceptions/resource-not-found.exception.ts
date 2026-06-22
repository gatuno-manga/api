import { DomainException } from './domain.exception';

export class ResourceNotFoundException extends DomainException {
	constructor(message: string) {
		super(message);
		this.name = 'ResourceNotFoundException';
	}
}
