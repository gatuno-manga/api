import { Injectable, Logger, OnModuleInit, Inject } from '@nestjs/common';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from 'src/redis/redis.constants';
import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import { join } from 'path';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OnEvent } from '@nestjs/event-emitter';
import { ChapterUpdatedEvent } from 'src/books/chapters/events/chapter-updated.event';

@Injectable()
export class DownloadCacheService implements OnModuleInit {
    private readonly logger = new Logger(DownloadCacheService.name);
    private readonly CACHE_DIR = '/usr/src/app/data/cache/downloads';
    private readonly REDIS_PREFIX = 'download:cache:';
    private readonly TTL_SECONDS = 24 * 60 * 60; // 24 horas

    constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

    async onModuleInit() {
        // Criar diretório de cache se não existir
        try {
            await fs.mkdir(this.CACHE_DIR, { recursive: true });
            this.logger.log(`Cache directory initialized: ${this.CACHE_DIR}`);
        } catch (error) {
            const errorMessage =
                error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(
                `Failed to create cache directory: ${errorMessage}`,
            );
        }
    }

    /**
     * Gera uma chave de cache baseada nos capítulos e formato
     */
    private generateCacheKey(chapterIds: string[], format: string): string {
        // Ordenar IDs para garantir consistência
        const sortedIds = [...chapterIds].sort();
        const hashInput = `${sortedIds.join(',')}:${format}`;
        return createHash('sha256').update(hashInput).digest('hex');
    }

    /**
     * Gera o caminho completo do arquivo no cache
     */
    private getCacheFilePath(cacheKey: string, extension: string): string {
        return join(this.CACHE_DIR, `${cacheKey}.${extension}`);
    }

    /**
     * Verifica se existe um arquivo em cache válido
     */
    async get(
        chapterIds: string[],
        format: string,
        extension: string,
    ): Promise<Buffer | null> {
        const cacheKey = this.generateCacheKey(chapterIds, format);
        const redisKey = `${this.REDIS_PREFIX}${cacheKey}`;

        try {
            // Verificar se a chave existe no Redis
            const cachedPath = await this.redis.get(redisKey);
            if (!cachedPath) {
                this.logger.debug(`Cache miss for key: ${cacheKey}`);
                return null;
            }

            // Verificar se o arquivo existe
            const filePath = this.getCacheFilePath(cacheKey, extension);
            const fileExists = await fs
                .access(filePath)
                .then(() => true)
                .catch(() => false);

            if (!fileExists) {
                this.logger.warn(
                    `Cache file not found, removing Redis key: ${filePath}`,
                );
                await this.redis.del(redisKey);
                return null;
            }

            // Ler e retornar o arquivo
            this.logger.log(`Cache hit for key: ${cacheKey}`);
            return await fs.readFile(filePath);
        } catch (error) {
            const errorMessage =
                error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`Failed to get cache: ${errorMessage}`);
            return null;
        }
    }

    /**
     * Armazena um arquivo no cache
     */
    async set(
        chapterIds: string[],
        format: string,
        extension: string,
        data: Buffer,
    ): Promise<void> {
        const cacheKey = this.generateCacheKey(chapterIds, format);
        const redisKey = `${this.REDIS_PREFIX}${cacheKey}`;
        const filePath = this.getCacheFilePath(cacheKey, extension);

        try {
            // Salvar arquivo
            await fs.writeFile(filePath, data);

            // Salvar referência no Redis com TTL
            await this.redis.set(redisKey, filePath, 'EX', this.TTL_SECONDS);

            this.logger.log(
                `Cached file: ${filePath} (TTL: ${this.TTL_SECONDS}s)`,
            );
        } catch (error) {
            const errorMessage =
                error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`Failed to set cache: ${errorMessage}`);
        }
    }

    /**
     * Invalida cache de um capítulo específico
     */
    @OnEvent('chapter.updated')
    async invalidateChapter(event: ChapterUpdatedEvent): Promise<void> {
        this.logger.log(
            `Invalidating cache for chapter ${event.chapterId} (book ${event.bookId})`,
        );

        try {
            // Buscar todas as chaves no Redis que contêm este capítulo
            const pattern = `${this.REDIS_PREFIX}*`;
            const keys = await this.redis.keys(pattern);

            for (const key of keys) {
                // Extrair o hash da chave
                const cacheKey = key.replace(this.REDIS_PREFIX, '');

                // Ler o caminho do arquivo
                const filePath = await this.redis.get(key);
                if (!filePath) continue;

                // Verificar se o arquivo contém dados deste capítulo
                // Como não temos como saber diretamente, vamos invalidar baseado no bookId
                // Uma melhoria futura seria armazenar metadados no Redis

                // Deletar arquivo
                await fs.unlink(filePath).catch(() => {
                    // Ignorar erro se arquivo não existe
                });

                // Remover do Redis
                await this.redis.del(key);

                this.logger.debug(`Removed cache: ${cacheKey}`);
            }
        } catch (error) {
            const errorMessage =
                error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(
                `Failed to invalidate chapter cache: ${errorMessage}`,
            );
        }
    }

    /**
     * Limpa arquivos de cache expirados (cron job diário)
     */
    @Cron(CronExpression.EVERY_DAY_AT_3AM)
    async cleanExpiredCache(): Promise<void> {
        this.logger.log('Starting cache cleanup job');

        try {
            // Buscar todas as chaves no Redis
            const pattern = `${this.REDIS_PREFIX}*`;
            const keys = await this.redis.keys(pattern);

            // Buscar todos os arquivos no diretório de cache
            const files = await fs.readdir(this.CACHE_DIR);

            // Criar set de caminhos válidos (que ainda estão no Redis)
            const validPaths = new Set<string>();
            for (const key of keys) {
                const path = await this.redis.get(key);
                if (path) validPaths.add(path);
            }

            // Deletar arquivos órfãos
            let deletedCount = 0;
            for (const file of files) {
                const filePath = join(this.CACHE_DIR, file);
                if (!validPaths.has(filePath)) {
                    await fs.unlink(filePath);
                    deletedCount++;
                    this.logger.debug(`Deleted orphan cache file: ${file}`);
                }
            }

            this.logger.log(
                `Cache cleanup completed. Deleted ${deletedCount} orphan files.`,
            );
        } catch (error) {
            const errorMessage =
                error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`Cache cleanup failed: ${errorMessage}`);
        }
    }

    /**
     * Limpa todo o cache (útil para testes ou manutenção)
     */
    async clearAll(): Promise<void> {
        this.logger.warn('Clearing all download cache');

        try {
            // Deletar todas as chaves do Redis
            const pattern = `${this.REDIS_PREFIX}*`;
            const keys = await this.redis.keys(pattern);
            if (keys.length > 0) {
                await this.redis.del(...keys);
            }

            // Deletar todos os arquivos do diretório de cache
            const files = await fs.readdir(this.CACHE_DIR);
            for (const file of files) {
                const filePath = join(this.CACHE_DIR, file);
                await fs.unlink(filePath);
            }

            this.logger.log(`Cleared ${keys.length} cache entries`);
        } catch (error) {
            const errorMessage =
                error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`Failed to clear cache: ${errorMessage}`);
        }
    }
}
