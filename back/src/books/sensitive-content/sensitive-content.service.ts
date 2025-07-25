import { CreateSensitiveContentDto } from './dto/create-sensitive-content.dto';
import { UpdateSensitiveContentDto } from './dto/update-sensitive-content.dto';
import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { SensitiveContent } from '../entitys/sensitive-content.entity';
import { Repository, In, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { Book } from '../entitys/book.entity';

@Injectable()
export class SensitiveContentService {
    private readonly logger = new Logger(SensitiveContentService.name);
    constructor(
        @InjectRepository(SensitiveContent)
        private readonly sensitiveContentRepository: Repository<SensitiveContent>,
        @InjectRepository(Book)
        private readonly bookRepository: Repository<Book>,
    ) {}

    async getAll(maxWeightSensitiveContent: number = 0): Promise<SensitiveContent[]> {
        return this.sensitiveContentRepository.find({
            select: ['id', 'name'],
            order: { weight: 'ASC' },
            where: { weight: LessThanOrEqual(maxWeightSensitiveContent) },
        });
    }

    async getOne(id: string): Promise<SensitiveContent> {
        const sensitiveContent = await this.sensitiveContentRepository.findOne({ where: { id } });
        if (!sensitiveContent) {
            throw new NotFoundException(`Sensitive content with id ${id} not found`);
        }
        return sensitiveContent;
    }

    async create(dto: CreateSensitiveContentDto): Promise<SensitiveContent> {
        const sensitiveContent = this.sensitiveContentRepository.create(dto);
        return this.sensitiveContentRepository.save(sensitiveContent);
    }

    async update(id: string, dto: UpdateSensitiveContentDto): Promise<SensitiveContent> {
        const sensitiveContent = await this.getOne(id);
        Object.assign(sensitiveContent, dto);
        return this.sensitiveContentRepository.save(sensitiveContent);
    }

    async remove(id: string): Promise<void> {
        const sensitiveContent = await this.getOne(id);
        await this.sensitiveContentRepository.remove(sensitiveContent);
    }

    async mergeSensitiveContent(id: string, copy: string[]) {
        const sensitiveContent = await this.sensitiveContentRepository.findOne({
            where: { id },
        });
        if (!sensitiveContent) {
            this.logger.warn(`Sensitive content with id ${id} not found`);
            throw new NotFoundException(`Sensitive content with id ${id} not found`);
        }
        const copyContents = await this.sensitiveContentRepository.find({
            where: { id: In(copy) },
        });
        if (copyContents.length === 0) {
            this.logger.warn(`No sensitive content found for names: ${copy.join(', ')}`);
            throw new NotFoundException(`No sensitive content found for names: ${copy.join(', ')}`);
        }
        const books = await this.bookRepository
            .createQueryBuilder('book')
            .leftJoinAndSelect('book.sensitiveContent', 'sensitiveContent')
            .where('sensitiveContent.id IN (:...copyIds)', { copyIds: copy })
            .getMany();

        for (const book of books) {
            book.sensitiveContent = book.sensitiveContent.filter(sc => !copy.includes(sc.id));
            if (!book.sensitiveContent.some(sc => sc.id === id)) {
                book.sensitiveContent.push(sensitiveContent);
            }
            await this.bookRepository.save(book);
        }
        await this.sensitiveContentRepository.remove(copyContents);
        return sensitiveContent;
    }
}
