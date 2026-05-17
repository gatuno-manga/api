# Issue: Migrate Database R/W Split to Database Proxy (ProxySQL)

## Context
Currently, the Gatuno API handles MySQL replication natively via TypeORM in `primary-database.config.ts`, being explicitly aware of the `master` for writes and `slaves` for reads. 
As the infrastructure scales, coupling this logic to the application layer introduces risks: the API must be reconfigured to add/remove slaves, connections aren't multiplexed efficiently, and transparent failover is difficult.

## Objective
Move the read/write split and connection balancing responsibilities from TypeORM to an infrastructure-level proxy like ProxySQL or HAProxy. The API will connect to the proxy as if it were a single, standard MySQL instance.

## Technical Details
- **Infrastructure (Docker/DevOps):** 
  - Add a ProxySQL container to `docker-compose.common.yml` (and production equivalents).
  - Configure Host Groups (e.g., HG 1 for Master, HG 2 for Slaves).
  - Set up query rules (Regex) to route `SELECT` to HG 2 and `INSERT/UPDATE/DELETE` to HG 1.
- **Application (NestJS/TypeORM):** 
  - Remove the `replication` block from `src/infrastructure/database/primary-database.config.ts`.
  - Point the TypeORM connection host to the new Proxy container.
- **Advantages:** Transparent failover, connection multiplexing (reducing load on the DB), and decoupled infrastructure.

## Tasks
- [ ] **DevOps:** Add ProxySQL configuration to Docker Compose files.
- [ ] **DevOps:** Create ProxySQL initialization scripts (Hostgroups, Users, Query Rules).
- [ ] **Code:** Refactor `primary-database.config.ts` to remove TypeORM replication logic and connect to the proxy.
- [ ] **Code:** Adjust environment variables (`.env.example`) to replace `DB_SLAVE_HOSTS` with proxy connection details.
- [ ] **Testing:** Verify that E2E tests still pass (ensure test setup connects to the master or test-proxy correctly).

## Verification
- Start the application and make a read request (e.g., fetch a book). Verify via ProxySQL stats (`stats_mysql_query_digest`) that the query was routed to a slave.
- Make a write request. Verify the query was routed to the master.
- Stop one slave container manually and ensure read requests do not fail (ProxySQL should seamlessly route to healthy instances).
