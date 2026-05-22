export class AlternativeTitle {
	title: string;
	languageCode: string | null;

	constructor(title: string, languageCode: string | null = null) {
		this.title = title;
		this.languageCode = languageCode;
	}
}
