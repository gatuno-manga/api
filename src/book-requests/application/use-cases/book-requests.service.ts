import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
	BookRequestRepository,
	I_BOOK_REQUEST_REPOSITORY,
} from '../ports/book-request.repository';
import { CreateBookRequestDto } from '../dto/create-book-request.dto';
import { RejectBookRequestDto } from '../dto/reject-book-request.dto';
import { BookRequest } from '../../domain/entities/book-request';
import {
	BookRequestHeader,
	BookRequestIdentity,
	BookRequestTiming,
} from '../../domain/value-objects/book-request-header.vo';
import {
	BookRequestBody,
	BookRequestProposition,
	BookInformation,
	BookRequestOutcome,
	ResolutionDetails,
} from '../../domain/value-objects/book-request-body.vo';
import { BookRequestTitle } from '../../domain/value-objects/book-request-title.vo';
import { BookRequestUrl } from '../../domain/value-objects/book-request-url.vo';
import { BookRequestReason } from '../../domain/value-objects/book-request-reason.vo';
import { BookRequestStatus } from '../../domain/enums/book-request-status.enum';
import { RejectionMessage } from '../../domain/value-objects/rejection-message.vo';
import { BookRequestEvents } from '../../domain/constants/events.constant';

@Injectable()
export class BookRequestsService {
	constructor(
		@Inject(I_BOOK_REQUEST_REPOSITORY)
		private readonly bookRequestRepository: BookRequestRepository,
		private readonly eventEmitter: EventEmitter2,
	) {}

	async create(dto: CreateBookRequestDto, userId: string): Promise<void> {
		const bookRequest = new BookRequest(
			new BookRequestHeader(
				new BookRequestIdentity('', userId),
				new BookRequestTiming(new Date(), new Date()),
			),
			new BookRequestBody(
				new BookRequestProposition(
					new BookInformation(
						new BookRequestTitle(dto.title),
						new BookRequestUrl(dto.url),
					),
					new BookRequestReason(dto.reason),
				),
				new BookRequestOutcome(
					BookRequestStatus.PENDING,
					new ResolutionDetails(null, new RejectionMessage(null)),
				),
			),
		);

		await this.bookRequestRepository.save(bookRequest);
		this.eventEmitter.emit(BookRequestEvents.CREATED, bookRequest);
	}

	async listMyRequests(userId: string): Promise<BookRequest[]> {
		return this.bookRequestRepository.findByUserId(userId);
	}

	async listAll(): Promise<BookRequest[]> {
		return this.bookRequestRepository.findAll();
	}

	async approve(id: string, adminId: string): Promise<void> {
		const request = await this.bookRequestRepository.findById(id);
		if (!request) {
			throw new NotFoundException('Book request not found');
		}

		const approvedRequest = request.approve(adminId);
		await this.bookRequestRepository.save(approvedRequest);
		this.eventEmitter.emit(BookRequestEvents.APPROVED, approvedRequest);
	}

	async reject(
		id: string,
		adminId: string,
		dto: RejectBookRequestDto,
	): Promise<void> {
		const request = await this.bookRequestRepository.findById(id);
		if (!request) {
			throw new NotFoundException('Book request not found');
		}

		const rejectedRequest = request.reject(adminId, dto.message ?? null);
		await this.bookRequestRepository.save(rejectedRequest);
		this.eventEmitter.emit(BookRequestEvents.REJECTED, rejectedRequest);
	}
}
