export class BookDescription {
	id: string;
	description: string;
	languageCode: string;
	rank: number;
	bookId: string;

	constructor(
		description: string,
		languageCode: string,
		rank = 0,
		bookId?: string,
	) {
		this.description = description;
		this.languageCode = languageCode;
		this.rank = rank;
		if (bookId) this.bookId = bookId;
	}
}
