# Gatuno Project Log

## Overview
Gatuno is a multi-platform ecosystem for content discovery and reading, consisting of a NestJS backend, a Flutter mobile app, and an Angular web frontend.

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
- **Scraping Engine:** A centralized, high-performance Playwright-based engine used to fetch and process content.
- **Book Relationships:** Support for complex work hierarchies (sequences, spin-offs, adaptations).
- **Synchronization:** Real-time reading progress and state synchronization across Web and Mobile.

## Project Structure
- `app/`: Flutter mobile application.
- `back/`: NestJS modular monolith backend.
- `front/`: Angular web application.
- `database/`: Migration scripts and database configuration.
- `monitoring/`: Configuration for the observability stack.
- `scripts/`: Utility scripts for database maintenance, backups, and migrations.
