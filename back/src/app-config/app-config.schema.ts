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
	API_URL: Joi.string().uri().required(),
	APP_URL: Joi.string().uri().required(),
});
