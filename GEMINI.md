# Gatuno API Project Log

## Overview
Gatuno API is the backend component of the Gatuno ecosystem, responsible for content discovery, scraping, and management. It is built with NestJS and follows a modular monolith architecture.

## Core Infrastructure & Tooling
- **Global Tooling:** 
  - Unified linting and formatting using **Biome**.
  - Security auditing with **Secretlint**.
  - Git hooks management via **Lefthook**.
- **Containerization:** Comprehensive Docker Compose setup for development, production, monitoring, and specialized tools.
- **Database Architecture:**
  - **Primary:** MySQL 8.4 with Master-Slave replication.
  - **Caching & Queues:** Redis 7.4 for BullMQ jobs, rate limiting, and secure session management.
- **Observability Stack:**
  - **Metrics:** Prometheus & Grafana.
  - **Logging:** Loki & Promtail.
  - **Alerting:** Alertmanager.

## Shared Domain Concepts
- **Scraping Engine:** An external event-driven microservice (Go + Playwright-Go) that processes extraction requests and communicates via Kafka.
- **Book Relationships:** Support for complex work hierarchies (sequences, spin-offs, adaptations).
- **Synchronization:** Real-time reading progress and state synchronization.

## Project Structure
- `src/`: NestJS source code.
- `test/`: Unit and E2E tests.
- `database/`: Migration scripts and database configuration.
- `monitoring/`: Configuration for the observability stack.
- `scripts/`: Utility scripts for database maintenance, backups, and migrations.

# AI Repository Directives

## Part 1: AI Behavioral Directives
These rules apply to every task in this project unless explicitly overridden. Bias: caution over speed on non-trivial work. Use judgment on trivial tasks.

**Rule 1 — Think Before Coding**
State assumptions explicitly. If uncertain, ask rather than guess. Present multiple interpretations when ambiguity exists. Push back when a simpler approach exists. Stop when confused. Name what's unclear.

**Rule 2 — Simplicity First**
Minimum code that solves the problem. Nothing speculative. No features beyond what was asked. No abstractions for single-use code. Test: would a senior engineer say this is overcomplicated? If yes, simplify.

**Rule 3 — Surgical Changes**
Touch only what you must. Clean up only your own mess. Don't "improve" adjacent code, comments, or formatting. Don't refactor what isn't broken. Apply Object Calisthenics refactoring only to new code or requested changes to avoid collateral damage.

**Rule 4 — Goal-Driven Execution**
Define success criteria. Loop until verified. Don't follow steps. Define success and iterate. Strong success criteria let you loop independently.

**Rule 5 — Use the model only for judgment calls**
Use the AI for: classification, drafting, summarization, extraction. Do NOT use it for routing, retries, deterministic transforms. If code can answer, code answers.

**Rule 6 — Context & Focus**
Maintain strict focus on the architectural constraints. If the conversation or context gets too long, summarize the current state and refocus on the main directives. Do not silently lose track of the rules.

**Rule 7 — Surface conflicts, don't average them**
If two patterns contradict, pick one (more recent / more tested). Explain why. Flag the other for cleanup. Don't blend conflicting patterns.

**Rule 8 — Read before you write**
Before adding code, read exports, immediate callers, shared utilities. "Looks orthogonal" is dangerous. If unsure why code is structured a way, ask.

**Rule 9 — Tests verify intent, not just behavior**
Tests must encode WHY behavior matters, not just WHAT it does. A test that can't fail when business logic changes is wrong. See Part 2 for the specific AAA standard.

**Rule 10 — Checkpoint after every significant step**
Summarize what was done, what's verified, what's left. Don't continue from a state you can't describe back. If you lose track, stop and restate.

**Rule 11 — Match the codebase's conventions, even if you disagree**
Conformance > taste inside the codebase. If you genuinely think a convention is harmful, surface it. Don't fork silently.

**Rule 12 — Fail loud**
"Completed" is wrong if anything was skipped silently. "Tests pass" is wrong if any were skipped. Default to surfacing uncertainty, not hiding it.

---

## Part 2: Domain & Architectural Mandates

### 1. Hexagonal Architecture Rules (Modular)
The Hexagonal structure must be applied within each NestJS module (e.g., `src/books/`, `src/auth/`).

* **Absolute Domain Isolation (`src/<module>/domain/`):**
  * This layer MUST NOT have any dependencies on infrastructure, external libraries, or frameworks (e.g., no NestJS, Express, TypeORM, or Prisma imports).
  * It must contain only pure classes, domain interfaces, Value Objects, and business Exceptions.
* **Ports and Use Cases (`src/<module>/application/`):**
  * Implement Use Cases that orchestrate the logic but do not perform direct I/O operations.
  * Define the Ports (Input and Output interfaces) that the domain needs to communicate with the external world (e.g., `UserRepository`).
* **Adapters and Infrastructure (`src/<module>/infrastructure/`):**
  * This is the ONLY place where external libraries, HTTP frameworks (like controllers), ORMs, database access, or queues (e.g., RabbitMQ) can reside.
  * Adapters MUST implement the interfaces (Ports) defined in the application layer.

---

### 2. Strict Code Rules (Object Calisthenics)
Whenever writing new code or explicitly refactoring the behavior of classes and methods (especially in the `domain` and `application` layers), apply the following rules:

1. **One level of indentation per method:** Extract complex logic into private methods with descriptive names.
2. **Don't use the `else` keyword:** Use *Early Return* (Guard Clauses) or Polymorphism.
3. **Wrap all primitives and strings:** Create *Value Objects* to represent domain concepts (e.g., create `Email` or `Cpf` instead of using `string`).
4. **First-class collections:** Any class that contains an array/collection should contain no other member variables. Encapsulate the collection.
5. **One dot per line (Law of Demeter):** Do not chain method calls of different objects (e.g., avoid `a.getB().getC().doSomething()`).
6. **Don't abbreviate:** Variables, methods, and classes must have clear and explicit names in English. Do not use `req`, `usr`, `idx`.
7. **Keep all entities small:** Classes must be cohesive. If a class or file is growing too much, divide the responsibilities.
8. **No classes with more than two instance variables:** Unpack classes with many properties by creating new Value Objects, *but use pragmatic judgment for DTOs and aggregate roots, prioritizing cohesion over strict arbitrary limits.*
9. **No getters/setters/properties:** Apply the *"Tell, Don't Ask"* principle. Create methods that execute actions based on the entity's state, rather than exposing its internal state.

---

### 3. Execution Instructions
* **Before writing code:** When asked to create a new feature, first present a brief plan of where the files will be created (Domain, Application, or Infrastructure) to ensure architectural boundaries are not violated.
* **Violation warnings:** If the user asks for something that violates these rules (e.g., importing the HTTP framework inside the domain entity), you MUST warn about the rule violation before suggesting the implementation.
* **Strict typing:** Make full use of TypeScript features. Avoid `any` at all costs.

---

### 4. Architectural Patterns & Protocols
* **Exception Handling:** The `domain` layer must only throw custom pure TypeScript Exceptions (e.g., `DomainException`). Framework-specific exceptions (e.g., NestJS `HttpException`) MUST NEVER be thrown from the domain or application layers. Convert Domain exceptions to HTTP responses exclusively via NestJS Exception Filters (`@Catch()`) or inside Controllers.
* **Dependency Injection for Ports:** When injecting interfaces (Ports) in the Application layer, always use custom Injection Tokens (e.g., `@Inject('IUserRepository')`) since TypeScript interfaces do not exist at runtime.
* **Testing Standards:** Follow the **AAA (Arrange, Act, Assert)** pattern for all test files. Tests must explicitly describe the business rules being validated. Utilize proper mocking frameworks (Jest/Vitest) as configured in the project.
* **Commit Messages:** Always suggest or generate Git commits following the **Conventional Commits** specification (`feat:`, `fix:`, `refactor:`, etc.) to comply with the project's Lefthook validations.

---

### 5. Image & Storage Mandates (Staging vs Final)
* **Image URL Generation:** Image URLs are dynamically resolved via `MediaUrlService`.
* **Path Prefix Prohibited:** You MUST NOT use the `pathPrefix` property in `uploadTarget` payloads sent to the Go scraper microservice via Kafka.
  * The Go microservice intrinsically handles the `shard/uuid.webp` format.
  * Adding a `pathPrefix` (e.g., `capas/`, `${chapter.id}/`) results in invalid, nested paths that break the frontend.
* **Storage Buckets:** Always use the `StorageBucket` enum to reference buckets (`BOOKS`, `USERS`, `PROCESSING`).
* **Staging Logic:** Any path starting with `processing/` indicates the image is still in the temporary bucket and will be automatically handled by `MediaUrlService`.

---

### 6. Validation and Scripts
To maintain code quality and ensure nothing is broken, you MUST run the appropriate validation scripts after making any changes. The following scripts are available in `package.json`:

* **Formatting & Linting:**
  * `npm run lint:biome` - Checks for linting errors using Biome.
  * `npm run lint:fix` - Automatically fixes safe linting errors using Biome.
  * `npm run format:biome` - Formats code using Biome.
  * `npm run lint:secrets` - Runs Secretlint to check for exposed secrets.
* **Testing:**
  * `npm run test` - Runs unit tests.
  * `npm run test:e2e` - Runs end-to-end tests.
  * `npm run test:cov` - Runs tests with coverage.
  * `npm run test:debug` - Runs tests in debug mode.
  * `npm run test:memory` - Runs tests checking for memory leaks.
* **Building & Running:**
  * `npm run build` - Compiles the NestJS application.
  * `npm run start:dev` - Starts the application in development mode with SWC.
  * `npm run start:debug` - Starts the application in debug mode.

**Mandatory Rule:** After implementing a change, you MUST ALWAYS run the relevant formatting/linting scripts (e.g., `npm run lint:fix` or `npm run format:biome`) and verify that tests pass (`npm run test`) before concluding the task. NEVER leave the code in a broken or unformatted state.

---

### 7. RBAC & Security Mandates
* **No `RolesEnum` for Authorization:** Do not use `@Roles()` decorators to protect endpoints. Roles (`RolesEnum.ADMIN`, `RolesEnum.USER`, `RolesEnum.GUEST`) exist merely as a grouping of permissions, defined and populated dynamically by `RbacSeederService`.
* **Explicit `@Permissions`:** All business domain routes must be protected using `@Permissions(PermissionsEnum.XXX)` combined with `PermissionsGuard`. Never leave an administrative endpoint unprotected or grouped under a completely unrelated permission (e.g., managing user profile should be `PROFILE_MANAGE`, not `BOOKS_VIEW`).
* **Unauthenticated/Guest Flow:** By design, unauthenticated requests are interpreted by `PermissionsGuard` as having `GUEST` permissions (granted via `RbacSeederService`). Routes intended to be entirely public (e.g., `signup`, `signin`) or inherent to the user's login session lifecycle (e.g., `logout`, `refresh`, `mfa`) **should NOT** be decorated with `@Permissions`. They rely strictly on `JwtAuthGuard` or no guard at all.
* **Granular Profile Permissions:** Operations affecting a user's own data must use `PROFILE_VIEW` and `PROFILE_MANAGE`. `BOOKS_VIEW` should never be reused outside the scope of content visualization.
