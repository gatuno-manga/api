import { ArgumentMetadata, ValidationPipe } from '@nestjs/common';
import { UpdateUserDto } from './update-user.dto';

describe('UpdateUserDto', () => {
	const pipe = new ValidationPipe({
		transform: true,
		whitelist: true,
		forbidNonWhitelisted: true,
	});
	const metadata: ArgumentMetadata = {
		type: 'body',
		metatype: UpdateUserDto,
	};

	it('rejects preferences so PATCH /users cannot overwrite preference sections', async () => {
		// Act
		const result = pipe.transform(
			{ preferences: { theme: 'dark' } },
			metadata,
		);

		// Assert
		await expect(result).rejects.toThrow();
	});

	it('still accepts the remaining profile fields', async () => {
		// Act
		const result = await pipe.transform({ name: 'John Doe' }, metadata);

		// Assert
		expect(result).toEqual(expect.objectContaining({ name: 'John Doe' }));
	});
});
