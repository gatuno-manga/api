export const FULLTEXT_COLUMNS =
	'`book`.`title`, `book`.`alternative_titles_text`' as const;
export const LIKE_FALLBACK_COLUMNS = [
	'book.title',
	'book.alternative_titles_text',
] as const;
export const FULLTEXT_SPECIAL_CHARS_REGEX = /[+\-><()~*"@]/g;
