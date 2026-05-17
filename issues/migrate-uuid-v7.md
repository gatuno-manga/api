# Issue: Migrate from UUIDv4 to UUIDv7

## Context
Currently, the Gatuno API uses UUIDv4 for generating unique identifiers. Because UUIDv4 is completely random, it causes severe index fragmentation (page splits) in our MySQL 8.4 InnoDB B-Tree indexes as the tables grow, leading to degraded write performance. 
UUIDv7 is time-sortable and solves this problem by ensuring sequential inserts (similar to `AUTO_INCREMENT`), maintaining excellent index health.

## Objective
Update the ID generation logic across the application to use UUIDv7 instead of UUIDv4 for all new records.

## Technical Details
- **Dependency:** Our current `uuid` library is already at `^11.1.0`, which natively supports UUIDv7. No new dependencies are needed.
- **Database Schema:** MySQL handles both versions identically (128-bits / 36 chars). No schema changes or data migrations are required. Old UUIDv4 records will coexist peacefully with new UUIDv7 records.
- **Application Layer:** Adjust the `uuid` import and generation function in the Domain/Application layers (e.g., changing `uuidv4()` to `uuidv7()`).

## Tasks
- [x] Locate all instances of `import { v4 as uuidv4 } from 'uuid';` in the codebase.
- [x] Replace them with `import { v7 as uuidv7 } from 'uuid';`.
- [x] Update function calls from `uuidv4()` to `uuidv7()`.
- [x] Run test suite (`npm run test`) to ensure no hardcoded v4 validations are breaking.
- [x] Run formatting and linting (`npm run lint:fix` / `npm run format:biome`).

## Verification
- Create a new record (e.g., a new User or Book) via the API.
- Verify in the database that the generated UUID is a valid version 7 UUID (the 13th character should be a `7`).
