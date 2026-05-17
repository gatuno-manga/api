# Issue: Decoupling and Cleaning Swagger Decorators from Controllers

## Context

Currently, the Gatuno API Controllers are accumulating a massive amount of visual responsibilities. The
extensive use of `@nestjs/swagger` decorators (`@ApiOperation`, `@ApiResponse`, `@ApiBody`, `@ApiQuery`, etc.)
alongside routing, validation, and security decorators (`@Get`, `@UseGuards`, `@Throttle`) clutters the
Controller code. This makes the files extremely difficult to read and shifts focus away from the actual
orchestration and business logic.

## Objective

Implement an architectural pattern that isolates Swagger documentation markup from the main source code of the
Controllers, improving readability and maintainability without losing the automatic API documentation
generation.

## Technical Details

There are two recommended approaches in the NestJS ecosystem to solve this problem. The team should standardize
the application using one (or both) of these strategies:

### Approach 1: Grouping with Custom Decorators (Method Decorators)

This is the simplest and fastest approach. You create an external file that exports a single custom decorator
containing all the documentation for a specific route.

**How it works:**
Instead of having 6 lines of Swagger above an endpoint, create a file (e.g., `auth.swagger.ts`):
import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

export function ApiDocsLogin() {
return applyDecorators(
ApiOperation({ summary: 'Authenticate user', description: 'Returns JWT tokens' }),
ApiResponse({ status: 200, description: 'Login successful', type: AuthResponseDto }),
ApiResponse({ status: 401, description: 'Invalid credentials' }),
);
}

In the Controller, the code becomes clean:
@Post('login')
@ApiDocsLogin() // <-- All documentation is hidden here
async login(@Body() dto: LoginDto) { ... }

### Approach 2: Documentation on Interfaces (Cleaner Architectural Approach)

This is a more robust approach, highly recommended for Hexagonal Applications. The Controller implements an
abstract interface where all the Swagger documentation "lives".

**How it works:**
You create an interface file (e.g., `auth-controller.interface.ts`):
export interface IAuthController {
@ApiOperation({ summary: 'Login' })
@ApiResponse({ status: 200 })
login(dto: LoginDto): Promise<AuthResponseDto>;
}
In the Controller, there is _absolutely no_ Swagger code. NestJS reads the interface thanks to TypeScript and
generates the documentation:
@Controller('auth')
export class AuthController implements IAuthController {
@Post('login')
async login(@Body() dto: LoginDto) { ... }
}
_(Note: The Interface approach requires enabling the Swagger CLI plugin in `nest-cli.json` so that interface
metadata is extracted during compilation)._

## Tasks

- [ ] Define the team's standard strategy (Custom Decorators vs Interfaces). We recommend starting with
      **Custom Decorators (`applyDecorators`)** as it is less intrusive to the build process.
- [ ] Create `docs` or `swagger` folders within the `infrastructure/http/` package of each module.
- [ ] Extract all `@Api...` decorators from a controller file (e.g., `auth.controller.ts`) into a new file
      (e.g., `auth.swagger.ts`).
- [ ] Replace the documentation blocks in the controller with the grouped custom decorators.
- [ ] Validate the `/api/docs` route to ensure no descriptions were lost after the migration.
- [ ] Apply the same pattern across all other Controllers in the application.

## Verification

- Open a Controller file (e.g., `auth.controller.ts`) and ensure that the ratio between "Documentation
  Decorator Lines" and "Actual Code Lines" is close to zero.
- Access the local Swagger UI and confirm that the route documentation (Statuses, Descriptions, Bodies, and
  Responses) remains identical to the previous version.
