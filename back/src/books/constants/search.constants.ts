export const FULLTEXT_COLUMNS = 'book.title, book.description' as const;
export const LIKE_FALLBACK_COLUMNS = ['book.alternativeTitle'] as const;
export const FULLTEXT_SPECIAL_CHARS_REGEX = /[+\-><()~*"@]/g;
