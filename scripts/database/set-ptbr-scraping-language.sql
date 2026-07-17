-- =============================================================================
-- Script: set-ptbr-scraping-language.sql
-- Descrição: Atualiza todos os livros para aceitar scraping apenas em pt-br.
--
-- O campo `allowedScrapingLanguages` usa o tipo simple-array do TypeORM,
-- que persiste arrays como CSV no banco (ex: "en,ja" ou "pt-br").
-- Um único elemento é salvo sem vírgula: "pt-br".
--
-- Como executar:
--   mysql -u <usuario> -p <banco> < scripts/set-ptbr-scraping-language.sql
-- =============================================================================

-- Pré-visualização: quantos livros serão afetados
SELECT
    COUNT(*) AS total_livros,
    SUM(allowedScrapingLanguages = 'pt-br' OR allowedScrapingLanguages IS NULL AND 'pt-br' IS NULL) AS ja_corretos,
    SUM(allowedScrapingLanguages != 'pt-br' OR allowedScrapingLanguages IS NULL) AS serao_atualizados
FROM books;

-- Aplicar atualização
UPDATE books
SET allowedScrapingLanguages = 'pt-br';

-- Confirmação pós-update
SELECT
    COUNT(*) AS total_livros,
    SUM(allowedScrapingLanguages = 'pt-br') AS configurados_ptbr
FROM books;
