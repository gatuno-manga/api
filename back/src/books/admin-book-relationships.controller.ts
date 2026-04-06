import {
	Body,
	Controller,
	Delete,
	Param,
	Patch,
	Post,
	UseGuards,
} from '@nestjs/common';
import {
	ApiBody,
	ApiBearerAuth,
	ApiOperation,
	ApiParam,
	ApiResponse,
	ApiTags,
} from '@nestjs/swagger';
import { Roles } from 'src/auth/decorator/roles.decorator';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { RolesEnum } from 'src/users/enum/roles.enum';
import { CreateBookRelationshipDto } from './dto/create-book-relationship.dto';
import { UpdateBookRelationshipDto } from './dto/update-book-relationship.dto';
import { BookBookRelationshipService } from './services/book-book-relationship.service';

@ApiTags('Books Admin')
@Controller('books')
@UseGuards(JwtAuthGuard)
@Roles(RolesEnum.ADMIN)
export class AdminBookRelationshipsController {
	constructor(
		private readonly bookBookRelationshipService: BookBookRelationshipService,
	) {}

	@Post(':idBook/relationships')
	@ApiOperation({
		summary: 'Criar relacionamento de livro',
		description:
			'Cria um relacionamento entre o livro da rota e outro livro (Admin only)',
	})
	@ApiParam({
		name: 'idBook',
		description: 'ID do livro de origem',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@ApiBody({
		type: CreateBookRelationshipDto,
		description: 'Payload para criar relacionamento entre livros',
		examples: {
			sequence: {
				summary: 'Sequência',
				value: {
					targetBookId: '7b23d8b0-ef45-4f6d-9aef-5f67ed901234',
					relationType: 'sequence',
					isBidirectional: false,
					order: 2,
					note: 'Continuação direta da história principal.',
					weight: 80,
				},
			},
			spinOff: {
				summary: 'Spin-off',
				value: {
					targetBookId: 'cfdcb4ab-2f1a-4f6f-a6cd-32f9f900abcd',
					relationType: 'spin-off',
					isBidirectional: true,
					note: 'Foco em personagem secundário.',
					weight: 70,
				},
			},
			adaptation: {
				summary: 'Adaptação',
				value: {
					targetBookId: '5f40c2c4-7a90-4b8b-aa11-5544c6f9ffff',
					relationType: 'adaptation',
					isBidirectional: true,
					note: 'Versão adaptada da obra original.',
				},
			},
		},
	})
	@ApiResponse({
		status: 201,
		description: 'Relacionamento criado com sucesso',
	})
	@ApiResponse({ status: 404, description: 'Livro não encontrado' })
	@ApiResponse({ status: 409, description: 'Relacionamento já existe' })
	@ApiBearerAuth('JWT-auth')
	createRelationship(
		@Param('idBook') idBook: string,
		@Body() dto: CreateBookRelationshipDto,
	): Promise<unknown> {
		return this.bookBookRelationshipService.createRelationship(idBook, dto);
	}

	@Patch(':idBook/relationships/:idRelationship')
	@ApiOperation({
		summary: 'Atualizar relacionamento de livro',
		description:
			'Atualiza os dados de um relacionamento existente (Admin only)',
	})
	@ApiParam({
		name: 'idBook',
		description: 'ID do livro no contexto da operação',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@ApiParam({
		name: 'idRelationship',
		description: 'ID do relacionamento',
		example: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
	})
	@ApiBody({
		type: UpdateBookRelationshipDto,
		description: 'Payload parcial para atualizar relacionamento',
		examples: {
			reorderSequence: {
				summary: 'Reordenar sequência',
				value: {
					order: 3,
					note: 'Mover para depois do arco principal.',
				},
			},
			makeBidirectional: {
				summary: 'Tornar bidirecional',
				value: {
					isBidirectional: true,
				},
			},
		},
	})
	@ApiResponse({
		status: 200,
		description: 'Relacionamento atualizado com sucesso',
	})
	@ApiResponse({ status: 404, description: 'Relacionamento não encontrado' })
	@ApiResponse({ status: 409, description: 'Conflito de relacionamento' })
	@ApiBearerAuth('JWT-auth')
	updateRelationship(
		@Param('idBook') idBook: string,
		@Param('idRelationship') idRelationship: string,
		@Body() dto: UpdateBookRelationshipDto,
	): Promise<unknown> {
		return this.bookBookRelationshipService.updateRelationship(
			idBook,
			idRelationship,
			dto,
		);
	}

	@Delete(':idBook/relationships/:idRelationship')
	@ApiOperation({
		summary: 'Remover relacionamento de livro',
		description: 'Realiza soft delete de um relacionamento (Admin only)',
	})
	@ApiParam({
		name: 'idBook',
		description: 'ID do livro no contexto da operação',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@ApiParam({
		name: 'idRelationship',
		description: 'ID do relacionamento',
		example: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
	})
	@ApiResponse({
		status: 200,
		description: 'Relacionamento removido com sucesso',
	})
	@ApiResponse({ status: 404, description: 'Relacionamento não encontrado' })
	@ApiBearerAuth('JWT-auth')
	deleteRelationship(
		@Param('idBook') idBook: string,
		@Param('idRelationship') idRelationship: string,
	): Promise<unknown> {
		return this.bookBookRelationshipService.deleteRelationship(
			idBook,
			idRelationship,
		);
	}
}
