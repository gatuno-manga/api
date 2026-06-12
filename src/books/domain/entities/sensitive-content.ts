export class SensitiveContent {
	id: string;
	name: string;
	altNames: { name: string; languageCode: string }[] | null;
	aliases: string[] | null;
	weight: number;
}
