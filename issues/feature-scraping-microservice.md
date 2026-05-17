# Issue: Extract Scraping Module to an Independent Microservice

## Context

Currently, the scraping engine (`ScrapingModule`) runs coupled within the Gatuno API's NestJS monolith.
Scraping is an operation with **extremely high CPU and Memory consumption**, as it manages real instances of
Chromium (Playwright), converts images, evaluates injected scripts on heavy pages, and communicates with
FlareSolverr.
Keeping this module inside the main API poses critical risks:

1.  Read traffic spikes (users reading books) compete for resources (RAM/CPU) with background scraping workers,
    which can cause severe slowdowns or _OOM (Out of Memory)_ crashes in the API.
2.  The main API cannot be scaled vertically/horizontally in an optimized way if the primary "weight" comes from
    scraping.
3.  Inherent memory leaks from Chromium directly affect the health of the entire API.

## Objective

Decouple the `ScrapingModule` from the main API, transforming it into an **Event-Driven Worker Microservice**.
This frees the API to exclusively serve HTTP traffic and manage the database.

## Technical Architecture & Impact

### 1. Asynchronous Communication (Messaging)

The current coupling relies on synchronous Dependency Injection (e.g., `BookContentUpdateService` calling
`this.scrapingService.scrapeBookInfo()`).
Communication must migrate to a message broker (BullMQ with Redis or Kafka, both already present in Gatuno's
stack).

- **New Flow:** The Gatuno API emits an event (e.g., `scraping.chapter.requested`) to the queue. The Scraping
  Microservice consumes the event, performs the heavy lifting with Playwright, and upon completion, pushes the
  result to a return queue (`scraping.chapter.completed`) or notifies the API via webhook.

### 2. Orchestration with the Go Microservice

The Gatuno project already has a Kafka contract for S3 image processing (`GO_MICROSERVICE_INTEGRATION.md`).

- **Synergy:** The Scraping Microservice will solely focus on bypassing DRM/Cloudflare and extracting the image
  into a "Raw" Buffer. It will upload this Raw file directly to S3 (to the `processing` bucket) and emit the
  `image.processing.requested` event for the Go microservice. The Scraper **will no longer need to compress
  images locally**, saving massive amounts of Node.js resources.

### 3. Database and Dependency Independence

Currently, the module accesses the `Website` table via TypeORM and uses the `FilesModule`.

- In the new microservice, there will be no dependency on the API's `FilesModule`. Uploads to S3 will be native
  (AWS SDK).
- Regarding site rules (`WebsiteConfigDto`), the main API should include the complete configuration payload in
  the Kafka/BullMQ message, removing the need for the scraper to access the monolith's database.

## Tasks

- [ ] Create a new standalone repository or directory (e.g., `apps/scraper-worker`) for the Node.js/NestJS
      microservice.
- [ ] Move the `src/scraping/infrastructure/browser` and `pool` directories to the new service.
- [ ] Implement a Consumer (Kafka or BullMQ) in the microservice to receive scraping commands.
- [ ] Remove internal compression from `NetworkInterceptor` and delegate the processing flow to the Go
      microservice (S3 + Kafka).
- [ ] Refactor Gatuno API services (`BookContentUpdateService`, `ChapterScrapingService`,
      `CoverImageProcessor`) to push messages to the queue instead of awaiting synchronous returns.
- [ ] Update environment variables and Docker Compose files to isolate the instances.

## Verification

- Test the end-to-end flow: The API requests a chapter scrape, the scraping microservice runs in isolation,
  sends raw images to S3 and notifies the Go microservice, and finally, the API updates the database.
- Perform a stress test on the scraper and monitor memory: The user-facing API must maintain a flat RAM
  consumption line, while the scraping worker scales resources across parallel containers.
