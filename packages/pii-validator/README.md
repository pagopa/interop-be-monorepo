# PII validator

Interop HTTP service scaffold for the future deterministic validation of supported PII categories.

## Current behavior

- `GET /status` exposes the standard service health endpoint.
- Authenticated `POST /detect` accepts only `{ "fields": [{ "fieldId": "title", "text": "..." }] }`: 1–10 fields, unique nonempty caller-provided `fieldId`, and `text` may be empty. Duplicate IDs or the retired single-text request receive a redacted `400`.
- A future successful response has `{ "results": [{ "fieldId": "title", "detectedCategories": ["EMAIL_ADDRESS"] }] }`: exactly one ordered result per field, with only detected categories from the closed vocabulary; empty text or no findings yields `[]`. Technical failures return no partial results. Text and candidates are never returned.
- The production service remains a scaffold and returns a redacted `501 Not Implemented` for valid batches. Tests inject a fake `DetectionService` only to verify the future `200` response schema; the production service never fabricates detections.

The closed API vocabulary contains:

- `EMAIL_ADDRESS`
- `IT_FISCAL_CODE`
- `IT_VAT_CODE`
- `IBAN_CODE`
- `CREDIT_CARD`
- `PHONE_NUMBER`
- `IT_IDENTITY_CARD`
- `IT_DRIVER_LICENSE`

These categories define the future API response shape. They are not implemented detection coverage. `PERSON` is deliberately excluded.

## Deferred work

This scaffold contains no recognizers, candidate extraction, regular expressions for detection, NLP model, persistence, process integration or accuracy evaluation. A later implementation will select and validate deterministic recognizers before enabling the production `200` path.

## Local development

From the repository root:

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
