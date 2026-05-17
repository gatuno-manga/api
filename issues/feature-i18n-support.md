# Issue: Implement Multi-Language Support (i18n) and Content Localization

## Context

Currently, the Gatuno API has hardcoded error messages, responses, and scraping configurations set to `pt-BR`.
The database model also does not support categorizing content by language, which prevents the platform from
serving a global audience. To scale as an international aggregator, the system needs to be aware of the user's
native language, as well as the language to which alternative titles and available chapters belong.

## Objective

Implement internationalization groundwork in the backend (`nestjs-i18n`), add language support to the user
profile, and refactor content entities (Book, Chapter, and Alt Titles) to support the coexistence and filtering
of multiple languages.

## Technical Details

### 1. i18n Foundation (System and User)

- Install and configure the `nestjs-i18n` package.
- Create the directory structure for translation dictionaries (e.g., `src/i18n/pt-BR/errors.json`,
  `src/i18n/en-US/errors.json`).
- Add a new column `preferredLanguage` (e.g., `VARCHAR(10)`, default: `'pt-BR'`) to the `User` entity. The
  system will use this preference for sending background emails, while synchronous requests can use the
  `Accept-Language` header.

### 2. Multilingual Alternative Titles (Alt Titles)

- **Current Problem:** Alternative titles are generally stored in unclassified lists.
- **Solution:** Refactor the Alternative Titles structure so each item contains a language code. If it's a
  relational table today, add a `languageCode` column (e.g., `ja-JP`, `ko-KR`, `en-US`). This allows the
  interface to display the country origin for that title (Romanized, Native, English, etc.).

### 3. Chapters in Multiple Languages

- **Current Problem:** There is no language separation for chapters, assuming all are in the same language.
- **Solution:** Add a `language` column (e.g., `'pt-BR'`, `'en-US'`, `'es-ES'`) to the `Chapter` entity.
- This enables a single `Book` to aggregate different translations. For example, "Chapter 1" can have one
  version translated by Scan A (pt-BR) and another by Scan B (en-US).

### 4. API Listing and Filters

- Update the chapter listing endpoint (`GET /books/:id/chapters` or equivalent GraphQL Resolver) to accept
  language filters (e.g., `?lang=pt-BR,en-US`).
- Update the Chapter response DTOs to always expose the `language` field, allowing the Frontend to display the
  corresponding flag in the chapter list.

### 5. Scraping Engine

- Add a `contentLanguage` field to the source/site registration (`WebsiteConfigDto`).
- During scraping, all new chapters generated from that site must be automatically saved to the database with
  the `language` tag defined in the target site's configuration.
- Pass the configured `locale` of the site directly to the Playwright context, preventing regional leaks
  (Geo-Blocking).

## Tasks

- [ ] Install and configure the global `nestjs-i18n` module.
- [ ] Create a migration to add `preferredLanguage` to `User`.
- [ ] Create a migration to add `languageCode` to alternative titles.
- [ ] Create a migration to add `language` to the `Chapter` entity.
- [ ] Update TypeORM Entities (`User`, `Chapter`, `BookAltTitles`/`Book`).
- [ ] Update Chapter search and listing endpoints to support dynamic language filtering.
- [ ] Modify the Scraping module to inherit and save the language based on the Website configuration.
- [ ] Update validations and unit tests affected by the new requirements.

## Verification

- Set the `Accept-Language: en-US` header in an invalid request and verify if the error returns in English.
- Scrape a site configured as `es-ES` and ensure that the chapters appear in the database with the correct
  language.
- Call the chapter listing passing the filter `lang=pt-BR` and verify that `en-US` chapters are hidden.
