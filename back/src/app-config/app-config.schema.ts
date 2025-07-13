import * as Joi from 'joi';

export const validationSchema = Joi.object({
	NODE_ENV: Joi.string()
		.valid('development', 'production', 'test')
		.default('development')
		.description('The Node.js environment'),
	PORT: Joi.number()
		.min(0)
		.max(65535)
		.default(3000)
		.description('The port on which the application will run'),
	SELENIUM_URL: Joi.string().uri().required(),
	DB_TYPE: Joi.string().required(),
	DB_NAME: Joi.string().required(),
	DB_HOST: Joi.string().required(),
	DB_PORT: Joi.number().min(0).max(65535).required(),
	DB_USER: Joi.string().required(),
	DB_PASS: Joi.string().required(),
	API_URL: Joi.string().required(),
	APP_URL: Joi.string().required(),
	JWT_ACCESS_SECRET: Joi.string().default('default_secret'),
	JWT_ACCESS_EXPIRATION: Joi.string().default('15m'),
	JWT_REFRESH_SECRET: Joi.string().default('default_refresh_secret'),
	JWT_REFRESH_EXPIRATION: Joi.string().default('60m'),
	SALT_LENGTH: Joi.number().min(1).default(16),
	PASSWORD_KEY_LENGTH: Joi.number().min(1).default(64),
	REDIS_HOST: Joi.string().required(),
	REDIS_PORT: Joi.number().min(0).max(65535).default(6379),
	REDIS_PASSWORD: Joi.string().optional().allow(''),
});
