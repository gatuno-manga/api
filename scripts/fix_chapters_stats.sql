-- Gatuno API - Reparo de stats de Capítulos (totalChapters e chaptersPerLanguage)
-- Este script varre a tabela chapters, conta a quantidade de capítulos por idioma para cada livro
-- e aplica o UPDATE diretamente na tabela books.

-- Compatível com MySQL 8.0+

UPDATE books b
LEFT JOIN (
    SELECT 
        bookId,
        MAX(count) as max_chapters,
        JSON_ARRAYAGG(JSON_OBJECT('language', languageCode, 'count', count)) as chapters_json
    FROM (
        SELECT bookId, languageCode, COUNT(id) as count
        FROM chapters
        WHERE deletedAt IS NULL
        GROUP BY bookId, languageCode
    ) lc
    GROUP BY bookId
) agg ON b.id = agg.bookId
SET 
    b.totalChapters = COALESCE(agg.max_chapters, 0),
    b.chaptersPerLanguage = COALESCE(agg.chapters_json, JSON_ARRAY());
