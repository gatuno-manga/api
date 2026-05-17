# Issue: Performance and Resilience Bottlenecks in the Scraping Engine

## Context

A detailed architectural review of the `scraping` module (`scraping.service.ts`, `image-downloader.ts`,
`network-interceptor.ts`, etc.) revealed critical bottlenecks affecting scalability, fault tolerance, and
server resource consumption (CPU/RAM). These issues become particularly severe when processing heavy websites
or platforms utilizing DRM/Canvas obfuscation.

## Objective

Implement structural improvements in the image extraction pipeline, network caching, concurrency management,
and Playwright integration to prevent Out-Of-Memory (OOM) crashes, system deadlocks, and performance
degradation.

## Technical Details & Issues

### 1. Memory Bottleneck via Base64 Conversion (WebSocket CDP)

- **Issue:** In `image-downloader.ts`, the fallback `fetchImageViaPageContext` downloads the image within the
  browser, converts it entirely to Base64, and sends this massive string over Playwright's WebSocket to Node.js.
  This inflates the payload by 33% and causes severe memory spikes (V8 Garbage Collection) just to convert it
  back to a Buffer.
- **Solution:** Eliminate Base64 conversion. Utilize Playwright's native download API or use
  `context.request.get()` while explicitly injecting the headers (like `Referer` and cookies) inherited from the
  page context to download the binary Buffer directly.

### 2. OOM Risk in `NetworkInterceptor`

- **Issue:** The interceptor buffers network responses in Node.js RAM. If a burst of large images arrives
  simultaneously and the compression queue is slow, the `inFlightBytes` property can grow uncontrollably before
  the cache is cleared, leading to process crashes.
- **Solution:** Implement _Backpressure_. If in-flight memory exceeds a safe threshold (e.g., 50MB), the
  interceptor must pause new Playwright downloads (`route.fallback()` / pause) or immediately flush incoming
  buffers to temporary files on disk (`/tmp`), relieving V8 heap pressure.

### 3. Redis Concurrency Deadlocks (Stuck Locks)

- **Issue:** `RedisConcurrencyManager` uses a static `slotTtlMs` of 20 minutes. If the Node.js worker crashes
  unexpectedly, the lock prevents any scraping for that domain for a full 20 minutes, causing unnecessary
  downtime.
- **Solution:** Switch the lock mechanism to a _Lease/Heartbeat_ pattern. The lock TTL should be short (e.g., 1
  minute), and the active Worker must run a `setInterval` to renew the lock every 30 seconds. If the node
  crashes, the lock is released in under a minute.

### 4. FlareSolverr Bypass Caching

- **Issue:** `FlareSolverr` is invoked to solve Cloudflare protections for every configured session. This is a
  CPU-intensive and slow process (10 to 25 seconds per request).
- **Solution:** After a successful bypass, store the resulting `User-Agent` and Cookies in Redis (with an
  appropriate TTL). Subsequent requests to the same domain must attempt to use this cached session data before
  falling back to invoking FlareSolverr again.

### 5. Optimization for Obfuscated Images (Canvas/DRM)

- **Issue:** The current `useScreenshotMode` takes a full DOM print via OS-heavy APIs. While necessary for
  obfuscated sites that assemble images inside a `<canvas>`, aggressively blocking network requests to save RAM
  could break the `.js`/`.wasm` scripts required to decrypt the images.
- **Solution:**
    1. Maintain the site's core scripts but implement an _AdBlock Whitelist_ strictly targeting known ad/tracking
       networks (e.g., `googleads`, `doubleclick`) to save resources without breaking the canvas decryption.
    2. Add a _Canvas Extraction_ strategy: Instead of `page.screenshot()`, inject a script into the browser to
       extract the buffer directly (`canvas.toDataURL('image/jpeg', 0.9)` or via binary blob extraction). This is
       significantly faster and more performant than an OS-level screenshot.

## Tasks

- [ ] Refactor `fetchImageViaPageContext` to prevent Base64 WebSocket transfers.
- [ ] Implement fast-disk flushing or backpressure mechanisms in `NetworkInterceptor`.
- [ ] Implement the Heartbeat pattern for distributed locks in `RedisConcurrencyManager`.
- [ ] Create a caching service for FlareSolverr Sessions (Cookies/UA).
- [ ] Create an optimized `<canvas>` data extraction strategy as an alternative to `useScreenshotMode`.
- [ ] Incorporate a basic AdBlock filter within the network interceptor.

## Verification

- Monitor API memory usage during a high-volume chapter scrape (50+ images) to ensure the absence of sharp
  CPU/RAM spikes.
- Abruptly kill the API (`kill -9`) during an active scrape and verify that the Redis lock is freed in less
  than 1 minute.
