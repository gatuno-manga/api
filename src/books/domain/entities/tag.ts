export class Tag {
	id: string;
	name: string;
	altNames: { name: string; languageCode: string }[] | null;
	aliases: string[] | null;
	description: string | null;
}
