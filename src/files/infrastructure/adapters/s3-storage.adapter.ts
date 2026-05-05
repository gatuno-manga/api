import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
	S3Client,
	PutObjectCommand,
	DeleteObjectCommand,
	HeadObjectCommand,
	ListObjectsV2Command,
	GetObjectCommand,
} from '@aws-sdk/client-s3';
import {
	StoragePort,
	FileMetadata,
} from '@files/application/ports/storage.port';

@Injectable()
export class S3StorageAdapter implements StoragePort {
	private readonly s3Client: S3Client;
	private readonly defaultBucket: string;
	private readonly logger = new Logger(S3StorageAdapter.name);

	constructor(private readonly configService: ConfigService) {
		const endpoint = this.configService.get<string>(
			'RUSTFS_ENDPOINT',
			'http://rustfs:9000',
		);
		this.defaultBucket = this.configService.get<string>(
			'RUSTFS_BUCKET',
			'gatuno-files',
		);

		this.s3Client = new S3Client({
			endpoint: endpoint,
			region: this.configService.get<string>(
				'RUSTFS_REGION',
				'us-east-1',
			),
			credentials: {
				accessKeyId: this.configService.get<string>(
					'RUSTFS_ACCESS_KEY',
					'rustfsadmin',
				),
				secretAccessKey: this.configService.get<string>(
					'RUSTFS_SECRET_KEY',
					'rustfsadmin',
				),
			},
			forcePathStyle: true, // Obrigatório para RustFS/MinIO
			tls: endpoint.startsWith('https'),
		});
	}

	async save(
		buffer: Buffer,
		fileKey: string,
		mimeType?: string,
		bucket?: string,
	): Promise<string> {
		try {
			await this.s3Client.send(
				new PutObjectCommand({
					Bucket: bucket || this.defaultBucket,
					Key: fileKey,
					Body: buffer,
					ContentType: mimeType,
				}),
			);

			// Retornamos apenas a chave do arquivo (ex: ab/uuid.webp)
			return fileKey;
		} catch (error) {
			this.logger.error(`Error saving file to S3: ${fileKey}`, error);
			throw error;
		}
	}

	async delete(fileKey: string, bucket?: string): Promise<void> {
		try {
			await this.s3Client.send(
				new DeleteObjectCommand({
					Bucket: bucket || this.defaultBucket,
					Key: fileKey,
				}),
			);
		} catch (error) {
			this.logger.error(`Error deleting file from S3: ${fileKey}`, error);
			// Não relançamos erro para manter compatibilidade com deleteFile atual (non-throwing)
		}
	}

	async exists(fileKey: string, bucket?: string): Promise<boolean> {
		try {
			await this.s3Client.send(
				new HeadObjectCommand({
					Bucket: bucket || this.defaultBucket,
					Key: fileKey,
				}),
			);
			return true;
		} catch (error: unknown) {
			if (
				error &&
				typeof error === 'object' &&
				'name' in error &&
				error.name === 'NotFound'
			) {
				return false;
			}
			throw error;
		}
	}

	async getStats(fileKey: string, bucket?: string): Promise<FileMetadata> {
		try {
			const head = await this.s3Client.send(
				new HeadObjectCommand({
					Bucket: bucket || this.defaultBucket,
					Key: fileKey,
				}),
			);

			return {
				filename: fileKey,
				size: head.ContentLength || 0,
				mtime: head.LastModified || new Date(),
			};
		} catch (error) {
			this.logger.error(`Error getting stats for ${fileKey}`, error);
			throw error;
		}
	}

	async getBuffer(fileKey: string, bucket?: string): Promise<Buffer> {
		try {
			const response = await this.s3Client.send(
				new GetObjectCommand({
					Bucket: bucket || this.defaultBucket,
					Key: fileKey,
				}),
			);

			if (!response.Body) {
				throw new Error(`Empty body for file ${fileKey}`);
			}

			const bytes = await response.Body.transformToByteArray();
			return Buffer.from(bytes);
		} catch (error) {
			this.logger.error(`Error reading buffer for ${fileKey}`, error);
			throw error;
		}
	}

	async *listAllFiles(bucket?: string): AsyncGenerator<FileMetadata> {
		let isTruncated = true;
		let continuationToken: string | undefined = undefined;

		try {
			while (isTruncated) {
				const response = await this.s3Client.send(
					new ListObjectsV2Command({
						Bucket: bucket || this.defaultBucket,
						ContinuationToken: continuationToken,
					}),
				);

				for (const content of response.Contents || []) {
					if (content.Key) {
						yield {
							filename: content.Key,
							size: content.Size || 0,
							mtime: content.LastModified || new Date(),
						};
					}
				}

				isTruncated = response.IsTruncated ?? false;
				continuationToken = response.NextContinuationToken;
			}
		} catch (error) {
			this.logger.error('Error listing files from S3', error);
		}
	}
}
