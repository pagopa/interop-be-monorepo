# PII validator

Interop HTTP service for deterministic recognition of selected PII categories in text.

## Current behavior

- `GET /status` exposes the standard service health endpoint.
- Authenticated `POST /detect` accepts only `{ "fields": [{ "fieldId": "title", "text": "..." }] }`: 1–10 fields, unique nonempty caller-provided `fieldId`, and `text` may be empty. Duplicate IDs or the retired single-text request receive a redacted `400`.
- A successful response has `{ "results": [{ "fieldId": "title", "detectedCategories": ["EMAIL_ADDRESS"] }] }`: exactly one ordered result per field, with only detected categories from the closed vocabulary; empty text or no findings yields `[]`. Technical failures return no partial results. Text and candidates are never returned.
- Six categories have active recognizers: `EMAIL_ADDRESS`, `IT_VAT_CODE`, `IBAN_CODE`, `CREDIT_CARD`, `PHONE_NUMBER` (Italian mobile numbers only) and `IT_DRIVER_LICENSE` (heuristic form only). A Moo lexer with literal clues and fallback extracts original UTF-16 spans without application regexes; `validator.js` checks email, VAT, IBAN, card and mobile candidates. Italian VAT is a complete 11-digit run bounded by non-digits; Italian IBAN is a complete compact 27-character block; cards contain contiguous digits; mobile numbers are ten contiguous digits, either bare or after `+39 ` with one space. The license heuristic accepts `U1` or `71`, seven ASCII alphanumeric characters and one final ASCII letter. A matching form does not establish existence, ownership or authenticity.
- `IT_FISCAL_CODE` and `IT_IDENTITY_CARD` are inactive. Detection returns category names only; input text and candidates stay in memory and are excluded from service responses, application logs and application audit payloads. Proxy and APM sinks are outside the service tests.

The closed API vocabulary contains:

- `EMAIL_ADDRESS`
- `IT_FISCAL_CODE`
- `IT_VAT_CODE`
- `IBAN_CODE`
- `CREDIT_CARD`
- `PHONE_NUMBER`
- `IT_IDENTITY_CARD`
- `IT_DRIVER_LICENSE`

`PERSON` is deliberately excluded. No NLP model, persistence, process integration or accuracy evaluation is included.

## Local development

From the repository root, with the repository's Node version:

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
