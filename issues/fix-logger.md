# Issue: Observability & Logging Misconfigurations (Env Vars Ignored)

## Context

During an audit of the application's observability stack (`custom.logger.ts`, `logger-rule-engine.ts`, and
`logging.module.ts`), several critical flaws were identified. Advanced logging configurations defined via
environment variables (`LOG_LEVEL`, `LOG_REDACT_PATHS`, and `LOG_SAMPLING_RATE`) are currently being ignored or
bypassed by the underlying Pino/nestjs-pino implementation. This leads to ineffective log filtering, missing
redaction trails, and high I/O overhead due to full HTTP request logging in production.

## Objective

Fix the configuration in `logging.module.ts` and `logger-rule-engine.ts` so that environment variables dictate
the true behavior of the logger, including Pino's base log level, HTTP middleware sampling, and sensitive data
redaction.

## Technical Details & Issues

### 1. `LOG_LEVEL` Bypass by Pino

- **Issue:** The `LoggerRuleEngine` correctly parses context-specific rules (e.g.,
  `context=AuthService;level=debug`). However, `logging.module.ts` initializes `pinoHttp` with a hardcoded base
  level: `level: isProduction ? 'info' : 'debug'`. If Pino's base level is `info`, it silently drops any `debug`
  or `trace` logs emitted by `CustomLogger`, rendering the environment variable useless for lowering the log
  level in production.
- **Solution:** Set `pinoHttp.level: 'trace'` unconditionally in `logging.module.ts`. This allows Pino to
  accept all levels, deferring the actual filtering responsibility entirely to your custom `LoggerRuleEngine`.

### 2. `LOG_REDACT_PATHS` Ineffectiveness

- **Issue:** The `LOG_REDACT_PATHS` variable tells Pino to redact specific fields like
  `req.headers.authorization`. However, the custom `serializers.req` in `logging.module.ts` explicitly drops all
  headers except `host`, `user-agent`, and `content-type`, and does not expose `req.body`. Because the sensitive
  paths never make it into the final log object, Pino's redact engine has nothing to censor.
- **Solution:** If explicit `[Redacted]` audit trails are desired, modify the `serializers.req` to include all
  headers (`headers: req.headers`) and the raw body. This allows Pino's redact engine to process the object and
  apply the rules defined in `LOG_REDACT_PATHS`.

### 3. `LOG_SAMPLING_RATE` Ignored for HTTP Requests (I/O Bottleneck)

- **Issue:** The `LOG_SAMPLING_RATE` logic is correctly applied within `CustomLogger` and `LoggerRuleEngine`.
  However, automatic HTTP request logs (the vast majority of log volume) are generated natively by the
  `nestjs-pino` middleware, completely bypassing the custom logger and its sampling engine.
- **Solution:** Inject the sampling logic directly into Pino's `autoLogging.ignore` property in
  `logging.module.ts`. Generate a random number against the `logSamplingRate` to drop a percentage of successful
  HTTP requests before they are logged.

## Tasks

- [ ] Change `pinoHttp.level` to `'trace'` in `logging.module.ts` to unblock `CustomLogger`.
- [ ] Update `serializers.req` in `logging.module.ts` to include the full `headers` object, enabling the
      `redact` rules to work.
- [ ] Implement sampling logic inside the `autoLogging.ignore` callback in `logging.module.ts` to apply
      `LOG_SAMPLING_RATE` to automatic HTTP logs.
- [ ] (Optional) Add a unit test or integration test to ensure that HTTP request logs respect the sampling
      rate.

## Verification

- Set `LOG_LEVEL=context=*;level=trace` and ensure trace logs appear in production.
- Send a request with an `Authorization` header and verify it appears as `[Redacted]` in the logs instead of
  being completely absent.
- Set `LOG_SAMPLING_RATE=0.1` and ensure approximately 90% of successful HTTP request logs are suppressed in
  the console.
