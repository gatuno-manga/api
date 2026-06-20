-- Adiciona um índice composto para suportar a paginação por cursor na tabela favorites.
-- Isso previne a ocorrência de "filesort" ao ordenar os favoritos por data de criação.

CREATE INDEX IDX_FAVORITES_PAGINATION ON favorites (userId, createdAt DESC, bookId DESC);
