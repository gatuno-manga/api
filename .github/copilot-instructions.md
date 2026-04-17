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
