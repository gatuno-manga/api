# Issue: Implement Incremental Synchronization (Delta Sync) for Reading Progress

## Context

Currently, the `syncProgress` method in `ReadingProgressService` performs a Full Sync when returning data to the client. If a user syncs 1 chapter but has 5,000 in their history, the API fetches and sends the remaining 4,999 every time. This wastes bandwidth, server processing, and client battery.

The ideal solution is to implement an Incremental Synchronization (Delta Sync) using the `lastSyncAt` property already present in the payload, so the API strictly returns records created or modified after that date.

Furthermore, to guarantee deletion consistency in a distributed architecture, we must adopt Soft Deletes (Tombstones). Without this, deletions made on the server will never reach clients performing a Delta Sync, as the records simply cease to exist.

## Objective

Optimize synchronization queries to use `lastSyncAt` and return only deltas (modified records). Modify the `ReadingProgress` entity to use Soft Deletes. Update the response DTO to inform clients about deleted progress records (`deleted: boolean`).

## Technical Details

- **Entity Soft Deletes:** Add the TypeORM `@DeleteDateColumn() deletedAt?: Date` to the `ReadingProgress` entity. Change physical deletions (`.delete()` or `.remove()`) to `.softDelete()` or `.softRemove()`.
- **Service Optimization:** In `ReadingProgressService`, conditionally add `whereCondition.updatedAt = MoreThan(new Date(dto.lastSyncAt));` to the `remoteOnly` query. Ensure `.find()` queries use `withDeleted: true`. Update the early return logic (when `dto.progress.length === 0`) to also respect `lastSyncAt` and `withDeleted: true`.
- **Response & Mappers:** Add a `deleted: boolean` property to `ReadingProgressResponseDto`. Map the presence of `deletedAt` to this boolean in `UserResourcesMapper`.

## Tasks

- [ ] Add `@DeleteDateColumn()` to the `ReadingProgress` entity.
- [ ] Generate the database migration for the new `deletedAt` column (`npm run build && npm run typeorm migration:generate ...`).
- [ ] Update `ReadingProgressResponseDto` to include the `deleted` flag.
- [ ] Update `UserResourcesMapper` to map `deleted: !!progress.deletedAt`.
- [ ] Refactor the `remoteOnly` query in `syncProgress` to use `lastSyncAt` and `withDeleted: true`.
- [ ] Refactor the early return logic (when `dto.progress` is empty) to use `lastSyncAt` and `withDeleted: true`.
- [ ] Update unit tests (`reading-progress.service.spec.ts`) to reflect the new delta sync and soft delete behaviors.
- [ ] Run formatting and linting (`npm run lint:fix` / `npm run format:biome`).

## Verification

- Perform a sync request with a recent `lastSyncAt` when the database has older records; the API should only return the newer records (deltas).
- Perform a soft delete on a progress record; a subsequent sync with a `lastSyncAt` prior to the deletion must
  return the record with `deleted: true`.
