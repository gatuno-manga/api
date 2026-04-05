# Gatuno Backend Development Log

## Core Architecture & Design Patterns

- **Framework:** NestJS-based modular monolith designed for scalability and maintainability.
- **Dependency Injection:** Centralized DI managed by NestJS.
- **Strategy Pattern:**
  - **Encryption:** Implemented in the `encryption` module for flexible password hashing. Supports Bcrypt, Argon2, and Scrypt strategies, allowing algorithm swaps with minimal impact.
  - **Books:** Used for different book processing or storage strategies.
- **Infrastructure Abstraction:**
  - **Files:** Uses an adapter pattern for file storage, allowing for future expansion beyond local filesystem storage.
  - **Scraping:** Uses a factory pattern for browser management (`PlaywrightBrowserFactory`).
- **Cross-Cutting Concerns:**
  - **Interceptors:** Global `LoggingInterceptor` and `MetricsInterceptor` for automated request logging and Prometheus metrics collection.
  - **Guards:** Global `ThrottlerGuard` for rate limiting and `JwtAuthGuard` (feature-specific) for security.
  - **Pipes:** Global `ValidationPipe` for DTO-based request validation.

## Features

- **Authentication:**
  - **Token Strategy:** JWT-based with rotating refresh tokens.
  - **Security:** Refresh tokens are encrypted before being stored in Redis to prevent theft if the cache is compromised.
  - **Session Management:** Supports single logout and "Logout from all sessions" by clearing user-specific keys in Redis.
  - **Autofill:** Optimized for password managers by providing appropriate response headers and clear auth flows.
- **Password Migration:**
  - Implemented transparent migration of user passwords to stronger hashing algorithms (e.g., Argon2) during the sign-in process.
- **Scraping Engine:**
  - **Technology:** Playwright/Puppeteer with stealth plugins to bypass anti-bot measures.
  - **Resource Management:** Implemented a `BrowserPool` to limit process count (default: 2 browsers) and prevent memory leaks.
  - **Performance:** Adaptive scrolling and network interception with LRU-based image caching and on-the-fly compression.
  - **Streaming:** Elements captured as screenshots are streamed to disk to minimize RAM spikes.
- **Books & Content:**
  - **Management:** Comprehensive CRUD for books, authors, chapters, and tags.
  - **Batch Operations:** Support for batch deletions and updates to improve administrative efficiency.
  - **Downloads:** Dynamic ZIP/PDF generation for chapters and books using `archiver` and `pdfkit`.
- **Health & Monitoring:**
  - **Health Checks:** Terminus-based endpoints for Liveness, Readiness, and Startup probes, monitoring Disk, Memory (Heap/RSS), and Redis/Database connectivity.
  - **Metrics:** Real-time Prometheus metrics at `/api/metrics`.

## Infrastructure

- **Database:**
  - **Primary:** MySQL 8+ with TypeORM.
  - **Replication:** Configured with Master-Slave replication support.
  - **Migrations:** Managed via raw SQL files in `database/migrations/` to ensure full control over schema changes.
- **Caching & Queues:**
  - **Redis:** Used for BullMQ queues, rate limiting, and secure token storage.
  - **Queues:** BullMQ handles background jobs for scraping, book updates, and file maintenance with exponential backoff.
- **Logging:**
  - **Structured Logging:** Powered by `pino` and `pino-http` for high-performance, machine-readable logs.
  - **PII Redaction:** Integrated with `AppLogger` to redact sensitive info (like emails) in production logs.
- **Docker:**
  - **Multi-stage builds:** Optimized production images using `node:22-alpine`.
  - **Environments:** Separate configurations for `dev`, `prod`, `monitoring`, and `tools`.

## Development Highlights

- **Resource Leak Fix (Feb 2026):**
  - Resolved critical memory leaks in the scraping module by implementing a proper browser pool and clearing network interception caches.
  - Reduced memory usage by ~67% under heavy load.
- **Security Hardening:**
  - Enabled HTTP-only cookies for refresh tokens.
  - Implemented role-based access control (RBAC) with `Admin` and `User` levels.
  - Added global rate limiting with short, medium, and long-term windows.
- **Adaptive Scraping:**
  - Introduced complexity detection for pages to automatically adjust timeouts and scrolling behavior based on the amount of content.

## Integration

- **API Base:** All endpoints are prefixed with `/api`.
- **Documentation:** Swagger UI available at `/api/docs` in development mode.
- **Frontend Sync:** Shared DTO structures and error response formats (`AppExceptions`) ensure consistent communication with the Flutter application.
