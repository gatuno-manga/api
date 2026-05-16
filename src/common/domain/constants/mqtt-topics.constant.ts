export const MqttTopics = {
	BOOKS: {
		ADMIN: 'books/events/admin',
		BOOK: (bookId: string) => `books/events/book/${bookId}`,
		CHAPTER: (chapterId: string) => `books/events/chapter/${chapterId}`,
	},
	USERS: {
		READING_PROGRESS: (userId: string) =>
			`users/${userId}/reading-progress`,
	},
} as const;
