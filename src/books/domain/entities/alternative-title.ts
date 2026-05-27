export class AlternativeTitle {
	title: string;
	languageCode: string | null;
	rank: number;

	constructor(title: string, languageCode: string | null = null, rank = 0) {
		this.title = title;
		this.languageCode = languageCode;
		this.rank = rank;
	}
}
