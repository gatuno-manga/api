import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OptionalAuthGuard extends AuthGuard('jwt') {
	handleRequest<TUser = unknown>(_err: unknown, user: TUser): TUser | null {
		return user || null;
	}
}
