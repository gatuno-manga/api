import { BookBuilder } from './book.builder';
import { BookType } from '../enum/book-type.enum';
import { ScrapingStatus } from '../enum/scrapingStatus.enum';

/**
 * Exemplos de uso do BookBuilder
 *
 * Este arquivo demonstra como usar o padrão Builder para criar livros
 * de forma mais legível e menos propensa a erros.
 */

// ==================== EXEMPLO 1: Livro Simples ====================
export function exemploLivroSimples() {
    const book = new BookBuilder()
        .withTitle('O Senhor dos Anéis')
        .withDescription('Uma épica aventura em Terra Média')
        .withType(BookType.BOOK)
        .withPublication(1954)
        .build();

    return book;
}

// ==================== EXEMPLO 2: Livro Completo ====================
export function exemploLivroCompleto() {
    const book = new BookBuilder()
        .withTitle('Harry Potter e a Pedra Filosofal')
        .withAlternativeTitles([
            "Harry Potter and the Philosopher's Stone",
            'Harry Potter e a Pedra Filosofal'
        ])
        .withDescription('O primeiro livro da série Harry Potter')
        .withType(BookType.BOOK)
        .withPublication(1997)
        .addOriginalUrl('https://exemplo.com/harry-potter')
        .withScrapingStatus(ScrapingStatus.READY)
        .build();

    return book;
}

// ==================== EXEMPLO 3: Novel/Webnovel ====================
export function exemploNovel() {
    const novel = new BookBuilder()
        .withTitle('Solo Leveling')
        .addAlternativeTitle('나 혼자만 레벨업')
        .addAlternativeTitle('Only I Level Up')
        .withDescription('A história de Sung Jin-Woo')
        .withType(BookType.MANHWA)
        .withPublication(2016)
        .addOriginalUrl('https://exemplo.com/solo-leveling')
        .build();

    return novel;
}

// ==================== EXEMPLO 4: Com Relacionamentos ====================
export async function exemploComRelacionamentos(
    tags: any[],
    authors: any[],
    sensitiveContent: any[]
) {
    const book = new BookBuilder()
        .withTitle('Game of Thrones')
        .withDescription('As Crônicas de Gelo e Fogo')
        .withType(BookType.BOOK)
        .withPublication(1996)
        .withTags(tags)
        .withAuthors(authors)
        .withSensitiveContent(sensitiveContent)
        .build();

    return book;
}

// ==================== EXEMPLO 5: Clonagem de Livro ====================
export function exemploClonagem(livroExistente: any) {
    // Cria uma cópia modificada de um livro existente
    const novaCopia = BookBuilder
        .fromExisting(livroExistente)
        .withTitle(`${livroExistente.title} - Cópia`)
        .withScrapingStatus(ScrapingStatus.PROCESS)
        .build();

    return novaCopia;
}

// ==================== EXEMPLO 6: Reutilização do Builder ====================
export function exemploReutilizacao() {
    const builder = new BookBuilder();

    // Primeiro livro
    const livro1 = builder
        .withTitle('Livro 1')
        .withType(BookType.BOOK)
        .build();

    // Reseta e cria segundo livro
    const livro2 = builder
        .reset()
        .withTitle('Livro 2')
        .withType(BookType.MANGA)
        .build();

    return [livro1, livro2];
}

// ==================== COMPARAÇÃO: COM vs SEM Builder ====================

// ❌ SEM Builder (complexo e verboso)
export function criaSemBuilder(manager: any) {
    const book = manager.create('Book', {
        title: 'Exemplo',
        originalUrl: ['https://exemplo.com'],
        alternativeTitle: ['Example'],
        description: 'Um exemplo',
        publication: 2024,
        type: BookType.BOOK,
        sensitiveContent: [],
        tags: [],
        authors: [],
        chapters: [],
    });
    return book;
}

// ✅ COM Builder (fluente e legível)
export function criaComBuilder() {
    const book = new BookBuilder()
        .withTitle('Exemplo')
        .addOriginalUrl('https://exemplo.com')
        .addAlternativeTitle('Example')
        .withDescription('Um exemplo')
        .withPublication(2024)
        .withType(BookType.BOOK)
        .build();
    return book;
}
