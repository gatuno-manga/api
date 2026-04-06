import { CacheTTL } from '@nestjs/cache-manager';
import {
	Controller,
	Get,
	Param,
	Query,
	UseGuards,
	UseInterceptors,
} from '@nestjs/common';
import {
	ApiOperation,
	ApiParam,
	ApiQuery,
	ApiResponse,
	ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from 'src/auth/decorator/current-user.decorator';
import { CurrentUserDto } from 'src/auth/dto/current-user.dto';
import { OptionalAuthGuard } from 'src/auth/guard/optional-auth.guard';
import { UserAwareCacheInterceptor } from 'src/common/interceptors/user-aware-cache.interceptor';
import { COMMON_RESPONSES } from 'src/common/swagger/common-responses';
import { BooksService } from './books.service';
import { BookChaptersCursorPageDto } from './dto/book-chapters-cursor-page.dto';
import { BookChaptersCursorOptionsDto } from './dto/book-chapters-cursor-options.dto';
import { BookRelationshipsPageDto } from './dto/book-relationships-page.dto';
import { BookRelationshipsQueryDto } from './dto/book-relationships-query.dto';
import { BookPageOptionsDto } from './dto/book-page-options.dto';

@ApiTags('Books')
@Controller('books')
export class BooksController {
	constructor(private readonly booksService: BooksService) {}

	@Get()
	@Throttle({ long: { limit: 100, ttl: 60000 } })
	@UseInterceptors(UserAwareCacheInterceptor)
	@CacheTTL(180)
	@ApiOperation({
		summary: 'Listar livros',
		description: 'Retorna uma lista paginada de livros com filtros',
	})
	@ApiResponse({ status: 200, description: 'Livros retornados com sucesso' })
	@ApiResponse(COMMON_RESPONSES.TOO_MANY_REQUESTS)
	@UseGuards(OptionalAuthGuard)
	getAllBooks(
		@Query() pageOptions: BookPageOptionsDto,
		@CurrentUser() user?: CurrentUserDto,
	) {
		return this.booksService.getAllBooks(
			pageOptions,
			user?.maxWeightSensitiveContent,
			user?.userId,
		);
	}

	@Get('random')
	@Throttle({ long: { limit: 100, ttl: 60000 } })
	@UseInterceptors(UserAwareCacheInterceptor)
	@CacheTTL(60)
	@ApiOperation({
		summary: 'Obter livro aleatorio',
		description: 'Retorna um livro aleatorio com base nos filtros',
	})
	@ApiResponse({
		status: 200,
		description: 'Livro aleatorio retornado com sucesso',
	})
	@ApiResponse(COMMON_RESPONSES.TOO_MANY_REQUESTS)
	@UseGuards(OptionalAuthGuard)
	getRandomBook(
		@Query() options: BookPageOptionsDto,
		@CurrentUser() user?: CurrentUserDto,
	) {
		return this.booksService.getRandomBook(
			options,
			user?.maxWeightSensitiveContent,
			user?.userId,
		);
	}

	@Get('check-title/:title')
	@Throttle({ medium: { limit: 50, ttl: 60000 } })
	@ApiOperation({
		summary: 'Verificar se titulo do livro ja existe',
		description:
			'Verifica se ja existe livro com o titulo informado ou titulos alternativos antes de criar um novo. Retorna todos os conflitos.',
	})
	@ApiParam({
		name: 'title',
		description: 'Titulo do livro para verificacao',
		example: 'One Piece',
	})
	@ApiQuery({
		name: 'alternativeTitles',
		description:
			'Titulos alternativos para verificar (separados por virgula)',
		required: false,
		example: 'ワンピース,Wan Pīsu',
	})
	@ApiResponse({
		status: 200,
		description:
			'Title check completed. Returns all books that conflict with the provided titles.',
		schema: {
			type: 'object',
			properties: {
				conflict: { type: 'boolean', example: true },
				existingBook: {
					type: 'object',
					description:
						'First conflicting book (for backwards compatibility)',
					properties: {
						id: {
							type: 'string',
							example: '550e8400-e29b-41d4-a716-446655440000',
						},
						title: { type: 'string', example: 'One Piece' },
						alternativeTitle: {
							type: 'array',
							items: { type: 'string' },
							example: ['ワンピース', 'Wan Pīsu'],
						},
					},
				},
				conflictingBooks: {
					type: 'array',
					description: 'All books that have conflicting titles',
					items: {
						type: 'object',
						properties: {
							id: {
								type: 'string',
								example: '550e8400-e29b-41d4-a716-446655440000',
							},
							title: { type: 'string', example: 'One Piece' },
							alternativeTitle: {
								type: 'array',
								items: { type: 'string' },
								example: ['ワンピース', 'Wan Pīsu'],
							},
						},
					},
				},
			},
		},
	})
	checkBookTitle(
		@Param('title') title: string,
		@Query('alternativeTitles') alternativeTitles?: string,
	) {
		const altTitlesArray = alternativeTitles
			? alternativeTitles
					.split(',')
					.map((t) => t.trim())
					.filter((t) => t.length > 0)
			: undefined;
		return this.booksService.checkBookTitleConflict(title, altTitlesArray);
	}

	@Get(':idBook')
	@Throttle({ long: { limit: 200, ttl: 60000 } })
	@UseInterceptors(UserAwareCacheInterceptor)
	@CacheTTL(1800)
	@ApiOperation({
		summary: 'Obter livro por ID',
		description: 'Retorna informacoes detalhadas de um livro especifico',
	})
	@ApiParam({
		name: 'idBook',
		description: 'Identificador unico do livro',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@ApiResponse({ status: 200, description: 'Livro encontrado' })
	@ApiResponse(COMMON_RESPONSES.NOT_FOUND)
	@ApiResponse(COMMON_RESPONSES.TOO_MANY_REQUESTS)
	@UseGuards(OptionalAuthGuard)
	getBook(@Param('idBook') id: string, @CurrentUser() user?: CurrentUserDto) {
		return this.booksService.getOne(
			id,
			user?.maxWeightSensitiveContent,
			user?.userId,
		);
	}

	@Get(':idBook/chapters')
	@Throttle({ long: { limit: 200, ttl: 60000 } })
	@UseInterceptors(UserAwareCacheInterceptor)
	@CacheTTL(600)
	@ApiOperation({
		summary: 'Obter capitulos do livro',
		description: 'Retorna capitulos de um livro especifico',
	})
	@ApiParam({
		name: 'idBook',
		description: 'Identificador unico do livro',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@ApiQuery({
		name: 'cursor',
		required: false,
		description: 'Cursor em base64 retornado na página anterior',
		example: 'MTAwLjA=',
	})
	@ApiQuery({
		name: 'limit',
		required: false,
		description: 'Quantidade de capítulos por página',
		example: 200,
	})
	@ApiResponse({
		status: 200,
		description: 'Capitulos retornados com sucesso',
		type: BookChaptersCursorPageDto,
	})
	@ApiResponse(COMMON_RESPONSES.NOT_FOUND)
	@ApiResponse(COMMON_RESPONSES.TOO_MANY_REQUESTS)
	@UseGuards(OptionalAuthGuard)
	getBookChapters(
		@Param('idBook') id: string,
		@Query() options: BookChaptersCursorOptionsDto,
		@CurrentUser() user?: CurrentUserDto,
	): Promise<BookChaptersCursorPageDto> {
		return this.booksService.getChapters(
			id,
			options,
			user?.userId,
			user?.maxWeightSensitiveContent,
		);
	}

	@Get(':idBook/covers')
	@Throttle({ long: { limit: 200, ttl: 60000 } })
	@UseInterceptors(UserAwareCacheInterceptor)
	@CacheTTL(3600)
	@ApiOperation({
		summary: 'Obter capas do livro',
		description: 'Retorna todas as capas disponiveis de um livro',
	})
	@ApiParam({
		name: 'idBook',
		description: 'Identificador unico do livro',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@ApiResponse({ status: 200, description: 'Capas retornadas com sucesso' })
	@ApiResponse(COMMON_RESPONSES.NOT_FOUND)
	@ApiResponse(COMMON_RESPONSES.TOO_MANY_REQUESTS)
	@UseGuards(OptionalAuthGuard)
	getBookCovers(
		@Param('idBook') id: string,
		@CurrentUser() user?: CurrentUserDto,
	) {
		return this.booksService.getCovers(
			id,
			user?.maxWeightSensitiveContent,
			user?.userId,
		);
	}

	@Get(':idBook/relationships')
	@Throttle({ long: { limit: 200, ttl: 60000 } })
	@UseInterceptors(UserAwareCacheInterceptor)
	@CacheTTL(600)
	@ApiOperation({
		summary: 'Obter relacionamentos do livro',
		description:
			'Retorna livros relacionados a um livro especifico, aplicando politicas de acesso e limites de conteudo sensivel',
	})
	@ApiParam({
		name: 'idBook',
		description: 'Identificador unico do livro',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@ApiResponse({
		status: 200,
		description: 'Relacionamentos retornados com sucesso',
		type: BookRelationshipsPageDto,
	})
	@ApiResponse(COMMON_RESPONSES.NOT_FOUND)
	@ApiResponse(COMMON_RESPONSES.TOO_MANY_REQUESTS)
	@UseGuards(OptionalAuthGuard)
	getBookRelationships(
		@Param('idBook') id: string,
		@Query() query: BookRelationshipsQueryDto,
		@CurrentUser() user?: CurrentUserDto,
	) {
		return this.booksService.getBookRelationships(
			id,
			query,
			user?.maxWeightSensitiveContent,
			user?.userId,
		);
	}

	@Get(':idBook/infos')
	@Throttle({ long: { limit: 200, ttl: 60000 } })
	@UseInterceptors(UserAwareCacheInterceptor)
	@CacheTTL(1800)
	@ApiOperation({
		summary: 'Obter informacoes do livro',
		description: 'Retorna informacoes adicionais e metadados de um livro',
	})
	@ApiParam({
		name: 'idBook',
		description: 'Identificador unico do livro',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@ApiResponse({
		status: 200,
		description: 'Informacoes do livro retornadas com sucesso',
	})
	@ApiResponse(COMMON_RESPONSES.NOT_FOUND)
	@ApiResponse(COMMON_RESPONSES.TOO_MANY_REQUESTS)
	@UseGuards(OptionalAuthGuard)
	getBookInfos(
		@Param('idBook') id: string,
		@CurrentUser() user?: CurrentUserDto,
	) {
		return this.booksService.getInfos(
			id,
			user?.maxWeightSensitiveContent,
			user?.userId,
		);
	}
}
