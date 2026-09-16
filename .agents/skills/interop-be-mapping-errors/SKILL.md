---
name: interop-be-mapping-errors
description: Generate an ENDPOINT-ERRORS.md file for a single Interop backend process from structured endpoint data supplied by the calling agent.
argument-hint: A process name and the corresponding endpoint data produced by the error-messages generator.
---

---

# Mapping Endpoint Errors

## Purpose

Generate `ENDPOINT-ERRORS.md` for a single Interop backend process.

The calling agent provides structured endpoint information produced by the
`error-messages-generator`. This skill uses that information as the source of
truth for endpoint metadata and mapper error information, and performs the
additional source-code and frontend analysis required to complete the document.

## Input

The calling agent MUST provide:

1. The process name.
2. The corresponding endpoint data from the error-messages generator.

The generator output follows the schema:

`packages/error-messages-generator/output.schema.json`

The relevant input is:

```text
output[process-name]
```

Each entry is an `Endpoint`.

The supplied endpoint data already contains:

- HTTP method
- endpoint path
- router file
- OpenAPI operation ID
- OpenAPI path
- OpenAPI file
- service name
- service method
- service file
- mapper name
- mapper file
- mapped errors
- authorization roles
- matching BFF endpoints

The `mapper.errors` array contains the error `code` and `message` for each
mapped error.

**Do not rediscover information already present in the supplied endpoint data.**

The supplied data is the authoritative source for this metadata.

## Output

Create:

```text
packages/[process-name]-process/ENDPOINT-ERRORS.md
```

Only generate the document for the supplied process.

Do not generate documents for other processes.

The document must contain one section per endpoint that has at least one
mapped non-500 error.

Endpoints whose mapper is `emptyErrorMapper` have no non-500 errors. List them
once in a note at the top and do not give them a section.

Work in the endpoint order supplied by the calling agent. This corresponds to
router declaration order.

## Output format

Use this structure:

```markdown
# Mapping Endpoint Errors

> Endpoints with `emptyErrorMapper` and therefore no mapped non-500 errors:
>
> - `GET /...`

## 1. `POST /eservices`

Service: `createEService` → `innerCreateEService`. Mapper: `createEServiceErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`, `M2M_ADMIN_ROLE`.

| Error          | Status | When it happens                                                | Reachable from the FE?                   | Steps to reproduce (UI)                        |
| -------------- | ------ | -------------------------------------------------------------- | ---------------------------------------- | ---------------------------------------------- |
| `someError`    | 409    | The concrete condition that triggers the error (`someAssert`). | **CAN HAPPEN** — the UI allows ...       | **Data precondition:** ...<br>1. ...<br>2. ... |
| `anotherError` | 403    | ...                                                            | Cannot happen — `AuthGuard` prevents ... | —                                              |

> **Unmapped error:** `someOtherError` can be thrown by `someHelper`, but is absent from the mapper. It ultimately produces HTTP 500 because it is a service-specific error.
```

### Important: no `Code` column

The output MUST NOT contain a `Code` column.

The generator output already supplies the error information required by this
skill.

Do not reconstruct or calculate wire codes.

The table therefore has exactly five columns:

```text
Error
Status
When it happens
Reachable from the FE?
Steps to reproduce (UI)
```

## Endpoint analysis

For each supplied endpoint:

### 1. Mapper errors

Create one row for every error in:

```text
endpoint.mapper.errors
```

Use the `code` field as the `Error` value.

Do not use the mapper factory/function name as the error name.

The supplied `message` is descriptive information only. Do not assume that
the message tells you when the error occurs.

Locate the actual throw site in the source code and determine the concrete
condition that produces the error.

If no reachable throw site exists, keep the row and mark it as a
**dead mapper entry**.

### 2. Status

Determine the HTTP status associated with each error by inspecting the mapper
and, where applicable, the fallback behaviour.

For a dead mapper entry, retain the status declared by the mapper.

### 3. Service analysis

Inspect the service method identified by:

```text
endpoint.service.file
endpoint.service.method
```

Trace the method and the helpers it calls.

Pay particular attention to:

- `inner*` functions;
- validators;
- version generators;
- assertions imported from `pagopa-interop-commons`;
- feature-flag assertions;
- other functions that can throw `ApiError`s.

For every mapped error, identify its actual throw site and guard condition.

### 4. Reverse check

Identify errors that the service flow can throw but that are absent from
`endpoint.mapper.errors`.

Document each such error in a `>` note below the endpoint's table.

Determine its actual resulting HTTP status before documenting it.

Do not automatically assume that an unmapped error results in HTTP 500.

## Common error fallback

When a mapper produces HTTP 500, `makeApiProblemBuilder` applies the common
error mapper.

The relevant common mappings are:

| Error                      | Status |
| -------------------------- | ------ |
| `badRequestError`          | 400    |
| `invalidPdfSignatureError` | 400    |
| `invalidFileUploadError`   | 400    |
| `tokenVerificationFailed`  | 401    |
| `unauthorizedError`        | 403    |
| `operationForbidden`       | 403    |
| `contentTooLargeError`     | 413    |
| `tooManyRequestsError`     | 429    |
| `featureFlagNotEnabled`    | 501    |

Other errors, including service-specific errors, result in 500 through this
fallback.

Verify the repository implementation when necessary.

## Frontend reachability

Determine whether each error can be produced by a normal UI interaction.

Trace:

```text
route authLevels
→ AuthGuard
→ UI action
→ form
→ BFF
→ backend process
```

The supplied endpoint data includes the BFF endpoints associated with the
process endpoint. Use that information to locate the relevant BFF code.

The BFF can:

- inject values that the frontend does not send;
- overwrite or normalise values;
- perform validation before calling the backend;
- prevent the backend endpoint from being reached.

A reachable error must be documented as:

```text
**CAN HAPPEN** — <specific reason>
```

An unreachable error must be documented as:

```text
Cannot happen — <specific reason>
```

Never write simply "the UI prevents it".

Crafted requests, replays and stale tabs are out of scope.

If the frontend repository is not available in the workspace, do not guess the
reachability result. Omit the frontend-dependent analysis and clearly state
that frontend reachability could not be determined.

## Steps to reproduce

Every `CAN HAPPEN` row must contain executable UI reproduction steps.

Start with:

```text
**Data precondition:** ...
```

Then provide numbered steps separated with `<br>`.

The steps must:

- start from a navigable UI entry point;
- use actual UI labels;
- end with the action that triggers the request;
- describe the relevant data/state required to reproduce the error.

Use the frontend locale files to obtain UI labels rather than inventing labels
from component or prop names.

For every `Cannot happen` row, the reproduction column must contain:

```text
—
```

If executable UI steps cannot be established, do not mark the error as
`CAN HAPPEN`.

## Verification

Before completing the task, verify that:

- the requested process is the only process being documented;
- the output file is `packages/[process-name]-process/ENDPOINT-ERRORS.md`;
- endpoints follow the supplied order;
- every mapped error is represented;
- the `Code` column is absent;
- no wire codes have been reconstructed;
- dead mapper entries remain documented;
- unmapped service errors were checked;
- common-error fallback behaviour was considered;
- every `CAN HAPPEN` row has executable reproduction steps;
- every `Cannot happen` row has `—` in the reproduction column;
- frontend reachability was not guessed when the frontend repository was unavailable.
