import { AppConfigModule } from '@app-config/app-config.module';
import { I_EMAIL_SERVICE } from '@auth/application/ports/email-service.port';
import { Module } from '@nestjs/common';
import { NodemailerEmailService } from './nodemailer-email.service';

@Module({
	imports: [AppConfigModule],
	providers: [
		{
			provide: I_EMAIL_SERVICE,
			useClass: NodemailerEmailService,
		},
	],
	exports: [I_EMAIL_SERVICE],
})
export class EmailModule {}
