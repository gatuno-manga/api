# Copilot instructions for `gatuno-api`

## Repository map
- `src/`: NestJS API (`/api` prefix), TypeORM + MySQL replication, Redis cache, BullMQ jobs.
- `test/`: Unit and E2E tests for the API.
- `database/`: MySQL master/slave bootstrap scripts and migrations.
- `monitoring/`: Prometheus, Grafana, Loki, Promtail and Alertmanager configuration.
- `scripts/`: Maintenance, backup and migration scripts.
- Root `docker-compose*.yml`: local/dev/prod/monitoring/tooling stacks.

## Tech stack
- **Backend**: NestJS, TypeORM (MySQL), BullMQ (Redis), Playwright (Scraping), Pino (Logging).
- **Environment**: Docker & Docker Compose.
- **Standards**: Biome (Lint/Format), Secretlint (Security), Lefthook (Hooks).

## Architecture
- Modular Monolith.
- Master-Slave DB replication (TypeORM read-connection-set).
- Background jobs for heavy tasks (Scraping, Image Processing).
- JWT Authentication with Rotating Refresh Tokens (Stored in Redis).

# AI Repository Directives

## Role and Objective
You are a Senior Software Architect and an extremely rigorous programmer. When generating, suggesting, or refactoring code in this repository, you must STRICTLY follow the principles of **Hexagonal Architecture (Ports and Adapters)** combined with **Object Calisthenics** rules. Quality, low coupling, and absolute domain isolation are non-negotiable.

---
## 1. Hexagonal Architecture Rules (Modular)
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
## 2. Strict Code Rules (Object Calisthenics)
Whenever writing or modifying the behavior of classes and methods (especially in the `domain` and `application` layers), apply the following rules:
1. **One level of indentation per method:** Extract complex logic into private methods with descriptive names.
2. **Don't use the `else` keyword:** Use *Early Return* (Guard Clauses) or Polymorphism.
3. **Wrap all primitives and strings:** Create *Value Objects* to represent domain concepts (e.g., create `Email` or `Cpf` instead of using `string`).
4. **First-class collections:** Any class that contains an array/collection should contain no other member variables. Encapsulate the collection.
5. **One dot per line (Law of Demeter):** Do not chain method calls of different objects (e.g., avoid `a.getB().getC().doSomething()`).
6. **Don't abbreviate:** Variables, methods, and classes must have clear and explicit names in English. Do not use `req`, `usr`, `idx`.
7. **Keep all entities small:** Classes must be cohesive. If a class or file is growing too much, divide the responsibilities.
8. **No classes with more than two instance variables:** Unpack classes with many properties by creating new *Value Objects*.
9. **No getters/setters/properties:** Apply the *"Tell, Don't Ask"* principle. Create methods that execute actions based on the entity's state, rather than exposing its internal state.

---
## 3. Execution Instructions
* **Before writing code:** When asked to create a new feature, first present a brief plan of where the files will be created (Domain, Application, or Infrastructure) to ensure architectural boundaries are not violated.
* **Violation warnings:** If the user asks for something that violates these rules (e.g., importing the HTTP framework inside the domain entity), you MUST warn about the rule violation before suggesting the implementation.
* **Strict typing:** Make full use of TypeScript features. Avoid `any` at all costs.

---
## 4. Validation and Scripts
To maintain code quality and ensure nothing is broken, you MUST run the appropriate validation scripts after making any changes. The following scripts are available in `package.json`:

* **Formatting & Linting:**
  * `npm run lint:biome` - Checks for linting errors using Biome.
  * `npm run lint:fix` - Automatically fixes safe linting errors using Biome.
  * `npm run lint` - Runs ESLint.
  * `npm run format:biome` - Formats code using Biome.
  * `npm run format` - Formats code using Prettier.
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
