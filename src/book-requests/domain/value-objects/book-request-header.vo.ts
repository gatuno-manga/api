export class BookRequestIdentity {
	constructor(
		public readonly id: string,
		public readonly userId: string,
	) {}
}

export class BookRequestTiming {
	constructor(
		public readonly createdAt: Date,
		public readonly updatedAt: Date,
	) {}
}

export class BookRequestHeader {
	constructor(
		public readonly identity: BookRequestIdentity,
		public readonly timing: BookRequestTiming,
	) {}
}
