# Issue: MFA Security and Performance Vulnerabilities

## Context

During a recent architectural review of the Gatuno API's Multi-Factor Authentication (MFA) implementation,
several structural flaws were identified. While the use of AES-256-GCM for secret encryption and stateless
Challenge Tokens are excellent practices, the current logic introduces a severe Denial of Service (DoS)
vulnerability via CPU exhaustion, a risk of TOTP Replay Attacks, and inadequate entropy for backup codes.

## Objective

Address critical vulnerabilities within the `MfaService` and `auth.controller.ts` to prevent CPU exhaustion
attacks, prevent TOTP token reuse within the same time window, and reinforce backup code generation.

## Technical Details

### 1. CPU Exhaustion (DoS) in Backup Codes

- **Issue:** The `consumeBackupCode` method iterates over all 8 backup codes, using
  `PasswordEncryption.compare()` (Bcrypt/Argon2) for each check. If a user inputs an invalid backup code, the
  server spends ~1 to 2.5 seconds calculating 8 slow hashes sequentially, blocking the Node.js event loop.
- **Solution:** Backup codes do not require slow hashing algorithms because they are highly entropic, random
  strings (not easily guessable passwords). Migrate from `PasswordEncryption` to a fast hashing algorithm like
  `SHA-256` for backup codes.

### 2. Replay Attack Vulnerability (TOTP Reuse)

- **Issue:** `otplib` mathematically validates the TOTP token but keeps no state. If an attacker intercepts a
  valid TOTP token, they can use it again within the same 30-second window.
- **Solution:** Ensure a TOTP code can only be used once. Cache the successfully verified TOTP code in Redis
  with a TTL of 30 seconds (or utilize `lastVerifiedAt` to block rapid consecutive successes).

### 3. Low Entropy in Backup Codes

- **Issue:** Backup codes are generated using `randomBytes(4).toString('hex')`, providing only 32 bits of
  entropy (8 hex chars).
- **Solution:** Increase the buffer to `randomBytes(8)` or `randomBytes(10)` and format them with better
  readability (e.g., `[4 chars]-[4 chars]`).

### 4. Missing Rate Limits

- **Issue:** `auth.controller.ts` lacks `@Throttle` decorators on `/mfa/totp/setup`, `/mfa/totp/verify-setup`,
  and `/mfa/totp/disable`.
- **Solution:** Apply explicit rate limiting to prevent setup abuse and database bloat.

## Tasks

- [ ] Replace `PasswordEncryption` with a fast cryptographic hash (e.g., `crypto.createHash('sha256')`) in
      `generateBackupCodes` and `consumeBackupCode`.
- [ ] **Crucial:** Provide a data migration strategy (or invalidate current backup codes) since existing users
      have Bcrypt/Argon2 hashes saved.
- [ ] Implement token consumption state tracking (Redis cache or strict DB validation) to prevent TOTP token
      reuse (Replay Attacks).
- [ ] Increase `randomBytes` length in `generateBackupCodes` to enhance entropy.
- [ ] Apply `@Throttle` decorators to all MFA management routes in `auth.controller.ts`.

## Verification

- Send multiple invalid backup codes rapidly; the CPU load should remain negligible (no event loop blocking).
- Attempt to authenticate twice with the exact same valid TOTP token within 30 seconds; the second attempt MUST
  be rejected.
