import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Tag } from '../entitys/tags.entity';
import { Repository, In } from 'typeorm';
import { Book } from '../entitys/book.entity';
import { TagsOptions } from './dto/tags-options.dto';
import { SensitiveContentService } from '../sensitive-content/sensitive-content.service';

@Injectable()
export class TagsService {
    private readonly logger = new Logger(TagsService.name);
    constructor(
        @InjectRepository(Tag)
        private readonly tagRepository: Repository<Tag>,
        @InjectRepository(Book)
        private readonly bookRepository: Repository<Book>,
        private readonly sensitiveContentService: SensitiveContentService,
    ) {}

    async getAll(options: TagsOptions, maxWeightSensitiveContent: number = 0): Promise<Tag[]> {
        const queryBuilder = this.bookRepository
            .createQueryBuilder('book')
            .leftJoinAndSelect('book.tags', 'tag')
            .leftJoin('book.sensitiveContent', 'sensitiveContent');

        await this.sensitiveContentService.filterBooksSensitiveContent(queryBuilder, options.sensitiveContent, maxWeightSensitiveContent);
        const books = await queryBuilder.getMany();

        const tagIds = Array.from(
            new Set(
                books.flatMap(book => book.tags.map(tag => tag.id))
            )
        );

        return this.tagRepository.find({
            where: { id: In(tagIds) },
            order: { name: 'ASC' },
        });
    }

    async mergeTags(id: string, copy: string[]) {
        const tag = await this.tagRepository.findOne({
            where: { id },
        });
        if (!tag) {
            this.logger.warn(`Tag with id ${id} not found`);
            throw new NotFoundException(`Tag with id ${id} not found`);
        }
        const copyTags = await this.tagRepository.find({
            where: { id: In(copy) },
        });
        if (copyTags.length === 0) {
            this.logger.warn(`No tags found for ids: ${copy.join(', ')}`);
            throw new NotFoundException(`No tags found for ids: ${copy.join(', ')}`);
        }
        const books = await this.bookRepository
            .createQueryBuilder('book')
            .leftJoinAndSelect('book.tags', 'tag')
            .where('tag.id IN (:...copyIds)', { copyIds: copy })
            .getMany();

        for (const book of books) {
            book.tags = book.tags.filter(t => !copy.includes(t.id));
            if (!book.tags.some(t => t.id === id)) {
                book.tags.push(tag);
            }
            await this.bookRepository.save(book);
        }
        await this.tagRepository.remove(copyTags);
        return tag;
    }
}
