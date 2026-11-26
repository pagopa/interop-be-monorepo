# PII validator

Interop HTTP service for deterministic recognition of selected PII categories in text.

## Current behavior

- `GET /status` exposes the standard service health endpoint.
- Authenticated `POST /detect` accepts only `{ "fields": [{ "fieldId": "title", "text": "..." }] }`: 1–10 fields, unique nonempty caller-provided `fieldId`, and `text` may be empty. Duplicate IDs or the retired single-text request receive a redacted `400`.
- A successful response has `{ "results": [{ "fieldId": "title", "detectedCategories": ["EMAIL_ADDRESS"] }] }`: exactly one ordered result per field, with only detected categories from the closed vocabulary; empty text or no findings yields `[]`. Technical failures return no partial results. Text and candidates are never returned.
- Seven categories have active recognizers: `EMAIL_ADDRESS`, `IT_VAT_CODE`, `IT_IBAN_CODE`, `CREDIT_CARD`, `IT_PHONE_NUMBER` (Italian mobile numbers only), `IT_CIE` and `IT_DRIVER_LICENSE`. Moo extracts original UTF-16 candidates by family in `candidateExtractors.ts`; named functions in `categoryValidators.ts` validate them with `validator.js` or dedicated licence format rules. The declarative family configuration and small orchestrator in `recognizers.ts` scan each family once per field and return unique categories in catalog order. Unicode word boundaries prevent extracting identifiers embedded in words. A matching form is a syntactic finding; existence, ownership and authenticity require separate verification.
- VAT, cards and mobile numbers share maximal numeric candidates: ASCII digits, optional `IT` or `+` prefix, and groups separated by one or more ASCII spaces. Each category validates the whole candidate independently. VAT and mobile checkers receive a copy with ASCII spaces removed; the card checker handles spaces itself. Original text and offsets are preserved. Adjacent numeric groups separated only by spaces form one candidate, so two separate identifiers in that form may remain undetected. Tabs, newlines, NBSP and hyphens stay outside the numeric token; a following digit group across a numeric separator invalidates the preceding candidate.
- Email extraction uses whole blocks with edge punctuation removed. IBAN, CIE and driving licences share whole contiguous Unicode alphanumeric candidates (including combining marks); country prefixes and document formats are checked only by their category validators. Italian IBAN retains its uppercase `IT` prefix and compact 27-character format. CIE delegates directly to `validator.isIdentityCard(text, "IT")`. Licence validation checks the two compact uppercase U1 serial formats from MIT circular 30039/2011; the final letter is checked syntactically. A bare phone suffix after a short numeric prefix separated by punctuation is suppressed; this contextual guard can also suppress a phone after an identifier ending in a short digit run.
- `IT_FISCAL_CODE` remains inactive. Detection returns category names only; input text and candidates stay in memory and are excluded from service responses, application logs and application audit payloads. Proxy and APM sinks are outside the service tests.

The closed API vocabulary contains:

- `EMAIL_ADDRESS`
- `IT_FISCAL_CODE`
- `IT_VAT_CODE`
- `IT_IBAN_CODE`
- `CREDIT_CARD`
- `IT_PHONE_NUMBER`
- `IT_CIE`
- `IT_DRIVER_LICENSE`

`PERSON` is deliberately excluded. No NLP model, persistence, process integration or accuracy evaluation is included.

## Local development

From the repository root, with Node `20.19.4` (the Docker runtime) and pnpm `10.29.3`:

```sh
pnpm --filter pagopa-interop-pii-validator build
pnpm --filter pagopa-interop-pii-validator check
pnpm --filter pagopa-interop-pii-validator lint
pnpm --filter pagopa-interop-pii-validator exec vitest run --config vitest.api.config.ts
pnpm --filter pagopa-interop-pii-validator exec vitest run --config vitest.auth.config.ts
```

The service uses the standard Interop HTTP, authentication and application-audit configuration. The dedicated authentication suite starts a controlled local JWKS server and does not require shared development infrastructure.

## Container

Build from the repository root:

```sh
docker build \
  -f packages/pii-validator/Dockerfile \
  -t interop/pii-validator:local \
  .
```

The runtime image uses the standard non-root user and exposes port `3000`. A full local startup smoke requires synthetic application-audit, Kafka and JWT/JWKS infrastructure; no deployment wiring is included in this slice.
