export class AuthorBiography {
	id: string;
	biography: string;
	languageCode: string;
	rank: number;
	authorId: string;

	constructor(
		biography: string,
		languageCode: string,
		rank = 0,
		authorId?: string,
	) {
		this.biography = biography;
		this.languageCode = languageCode;
		this.rank = rank;
		if (authorId) this.authorId = authorId;
	}
}
