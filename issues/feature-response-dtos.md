# Issue: Standardization and Implementation of Response DTOs Across the Application

## Context

During a code review, it was observed that the Gatuno API utilizes well-defined DTOs (Data Transfer Objects)
for incoming requests (e.g., `CreateUserDto`, `SaveReadingProgressDto`). However, the application lacks
consistent output DTOs. In many routes, the Controllers are directly returning TypeORM Entities or untyped
literal objects.
Returning database entities directly from the Controller is an architectural anti-pattern (leaking the
infrastructure/persistence layer into the presentation layer).

## Objective

Ensure that all API routes have and return a specific Response DTO. Furthermore, apply the NestJS interceptor
pattern to guarantee that sensitive or internal attributes (such as passwords, tokens, hashes, or database IDs)
do not accidentally leak to the frontend.

## Technical Details

### 1. Creation of Response DTOs

For each exposed entity or resource, there must be one (or more) corresponding Response DTOs (e.g.,
`BookResponseDto`, `UserResponseDto`, `ChapterResponseDto`).
These DTOs must utilize `@nestjs/swagger` decorators (e.g., `@ApiProperty()`) to ensure that the Swagger UI
automatically and correctly generates the API contract documentation.

### 2. Usage of `ClassSerializerInterceptor`

Instead of manually mapping entity fields in the Controller (which generates unnecessary boilerplate), we
should utilize the `class-transformer` package in conjunction with the NestJS `ClassSerializerInterceptor`.

- **`@Exclude()` Decorator:** Used on the Entity or DTO to ensure that properties like `password`,
  `hashedRefreshToken`, and `deletedAt` are never serialized in the JSON response.
- **`@Expose()` Decorator:** Used to ensure that only the explicitly desired fields are sent.

### 3. Mapper Layer (Hexagonal Architecture)

If the output formatting rules are highly complex (e.g., returning the full S3 URL of an image instead of the
relative database path), the mapping must be explicitly handled via Mapper classes in the _Application_ layer
(as seen in its early stages with `UserResourcesMapper`). These mappers convert the pure domain entity into a
Response DTO before the Controller sends it.

## Tasks

- [ ] Map all existing Controllers and identify endpoints that lack strict return types (Response DTOs).
- [ ] Create the Response DTO files (e.g., `book-response.dto.ts`, `chapter-response.dto.ts`) in the
      appropriate directory (usually `infrastructure/http/dto` or an equivalent inside the module).
- [ ] Add Swagger decorators (`@ApiProperty`, `@ApiResponse({ type: MyResponseDto })`) to all new Response DTOs
      and Controller methods.
- [ ] Apply the `@Exclude()` decorator to sensitive properties within the entities (such as password fields and
      internal sync/MFA control properties).
- [ ] Configure the `ClassSerializerInterceptor` globally in `main.ts` (or locally in the controllers) using
      `app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));`.
- [ ] Refactor Controllers so that the return types of functions change from `Promise<Any>` (or Entity types)
      to `Promise<ResourceNameResponseDto>`.

## Verification

- Call a refactored endpoint and verify that the JSON response strictly adheres to the structure defined in the
  Response DTO, without exposing leaked database properties (e.g., unrequested foreign keys, control dates).
- Access the `/api/docs` route (Swagger) and confirm that the success response format (HTTP 200) displays the
  exact structure and types of the corresponding Response DTO.
