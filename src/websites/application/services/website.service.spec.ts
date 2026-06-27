import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { RegisterWebSiteDto } from '@websites/application/dto/register-website.dto';
import { UpdateWebsiteDto } from '@websites/application/dto/update-website.dto';
import { I_WEBSITE_CACHE } from '@websites/application/ports/website-cache.interface';
import { I_WEBSITE_REPOSITORY } from '@websites/application/ports/website-repository.interface';
import { Website } from '@websites/domain/entities/website';
import { of } from 'rxjs';
import { WebsiteService } from './website.service';

describe('WebsiteService', () => {
	let service: WebsiteService;
	let websiteRepositoryMock: any;
	let websiteCacheMock: any;
	let scraperClientMock: any;

	beforeEach(async () => {
		websiteRepositoryMock = {
			save: jest.fn(),
			findAll: jest.fn(),
			findById: jest.fn(),
			findByUrl: jest.fn(),
			delete: jest.fn(),
		};

		websiteCacheMock = {
			set: jest.fn(),
			delete: jest.fn(),
		};

		scraperClientMock = {
			send: jest.fn(),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				WebsiteService,
				{
					provide: I_WEBSITE_REPOSITORY,
					useValue: websiteRepositoryMock,
				},
				{
					provide: I_WEBSITE_CACHE,
					useValue: websiteCacheMock,
				},
				{
					provide: 'SCRAPER_SERVICE',
					useValue: scraperClientMock,
				},
			],
		}).compile();

		service = module.get<WebsiteService>(WebsiteService);
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('registerWebsite', () => {
		it('should save the website and cache it', async () => {
			const dto = new RegisterWebSiteDto();
			dto.url = 'https://test.com';
			dto.selector = 'body';
			dto.preScript = 'console.log("test")';

			const savedWebsite = new Website();
			savedWebsite.id = '123';
			websiteRepositoryMock.save.mockResolvedValue(savedWebsite);

			const result = await service.registerWebsite(dto);

			expect(websiteRepositoryMock.save).toHaveBeenCalled();
			expect(websiteCacheMock.set).toHaveBeenCalledWith(savedWebsite);
			expect(result).toEqual(savedWebsite);
		});
	});

	describe('update', () => {
		it('should update the website and update the cache', async () => {
			const dto = new UpdateWebsiteDto();
			dto.url = 'https://updated.com';

			const existingWebsite = new Website();
			existingWebsite.id = '123';
			websiteRepositoryMock.findById.mockResolvedValue(existingWebsite);

			const updatedWebsite = new Website();
			updatedWebsite.id = '123';
			updatedWebsite.url = 'https://updated.com';
			websiteRepositoryMock.save.mockResolvedValue(updatedWebsite);

			const result = await service.update('123', dto);

			expect(websiteRepositoryMock.findById).toHaveBeenCalledWith('123');
			expect(websiteRepositoryMock.save).toHaveBeenCalled();
			expect(websiteCacheMock.set).toHaveBeenCalledWith(updatedWebsite);
			expect(result).toEqual(updatedWebsite);
		});

		it('should throw NotFoundException if website does not exist', async () => {
			websiteRepositoryMock.findById.mockResolvedValue(null);
			const dto = new UpdateWebsiteDto();

			await expect(service.update('123', dto)).rejects.toThrow(
				NotFoundException,
			);
			expect(websiteCacheMock.set).not.toHaveBeenCalled();
		});
	});

	describe('remove', () => {
		it('should delete from repository and remove from cache', async () => {
			await service.remove('123');

			expect(websiteRepositoryMock.delete).toHaveBeenCalledWith('123');
			expect(websiteCacheMock.delete).toHaveBeenCalledWith('123');
		});
	});

	describe('testScript', () => {
		it('should call scraperClient.send and return result', async () => {
			const expectedResult = { title: 'Test' };
			scraperClientMock.send.mockReturnValue(of(expectedResult));

			const result = await service.testScript(
				'https://test.com',
				'script',
				undefined,
				false,
			);

			expect(scraperClientMock.send).toHaveBeenCalledWith(
				'scraping.test',
				{
					targetUrl: 'https://test.com',
					script: 'script',
					useFlareSolverr: false,
				},
			);
			expect(result).toEqual({ isValid: true, result: expectedResult });
		});
	});
});
