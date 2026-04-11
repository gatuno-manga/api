# Copilot instructions for `gatuno`

## Monorepo map
- `back/`: NestJS API (`/api` prefix), TypeORM + MySQL replication, Redis cache, BullMQ jobs.
- `front/`: Angular 21 app with SSR + hydration + service worker.
- `app/`: Flutter mobile app (Dio + GetIt + GoRouter).
- `database/`: MySQL master/slave bootstrap scripts.
- Root `docker-compose*.yml`: local/dev/prod/monitoring/tooling stacks.

## Core architecture constraints
- Backend sets `app.setGlobalPrefix('api')`; all API routes are under `/api/*`.
- TypeORM runs with replication (1 master + N slaves) and currently `synchronize: true`.
- Global backend validation is strict (`transform`, `whitelist`, `forbidNonWhitelisted`).
- Authentication is split by client type:
  - **Web**: access token in client state + refresh token in HttpOnly cookie + CSRF header (`x-csrf-token`).
  - **Mobile**: identified by `x-client-platform: mobile` and receives refresh token in auth payload.
- Login security stack (already implemented): passkeys (WebAuthn), TOTP step-up MFA, audit history, connected sessions revocation.

## Commands (use existing scripts only)
### Root
- Install hooks: `npm run prepare`
- Lint all files (Biome): `npm run lint`
- Auto-fix with Biome: `npm run lint:fix`

### Backend (`cd back`)
- Install: `npm install`
- Dev server: `npm run start:dev`
- Build: `npm run build`
- Lint: `npm run lint`
- Unit tests: `npm test`
- Single test file: `npm test -- auth/auth.service.spec.ts --runInBand`
- E2E tests: `npm run test:e2e`

### Frontend (`cd front`)
- Install: `npm install`
- Dev server: `npm run start`
- Build: `npm run build` (runs `prebuild` and regenerates environment files)
- Headless tests: `npm run test:headless`
- Single spec: `npm run test:headless -- --include=src/app/pages/auth/login/login.component.spec.ts --watch=false`

### Flutter app (`cd app`)
- Install deps: `flutter pub get`
- Static analysis: `flutter analyze`
- Tests: `flutter test`
- Single test file: `flutter test test/features/authentication/domain/use_cases/auth_service_test.dart`

## API integration conventions
- In Angular services, use relative API paths like `'/auth/signin'`; `HttpClientRequestInterceptor` resolves full API URL.
- Do not assume every endpoint returns the same shape:
  - many resource endpoints return `{ data, meta, links }` via `DataEnvelopeInterceptor`.
  - auth/security endpoints may return raw payloads; when in doubt, support both raw and wrapped (`{ data: ... }`) payloads.
- Web auth/refresh/logout calls must use `withCredentials: true`.
- Browser requests should preserve device headers (`x-client-platform`, `x-device-id`, `x-device-name`) for risk/session tracking.

## Code patterns to preserve
- Backend modules follow Nest conventions (module/service/controller + DTO/entity split under each feature folder).
- Flutter DI uses GetIt singleton `sl` in `app/lib/core/di/injection.dart`; register feature injections there and wire interceptors with `setupAuthInterceptor(...)`.
- Token refresh concurrency is guarded in backend `TokenStoreService.runWithRefreshLock`; keep this behavior when altering refresh flow.

## Practical gotchas
- `back` lint script runs ESLint with `--fix`, so it can rewrite files.
- Root Biome lint can include generated artifacts (for example Flutter generated folders); prefer package-level checks during feature work.
- Angular auth 401 retry behavior excludes `/auth/refresh`, `/auth/signup`, and `/auth/signin`; update exclusion list if adding similar auth endpoints.
