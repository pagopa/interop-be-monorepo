---
name: local-mapping-endpoint-errors
description: Use when documenting which errors an endpoint of a pagopa interop backend process can return, what triggers each one, and whether the frontend can actually cause it — building or extending an endpoint/error map table.
---

# Mapping Endpoint Errors

## Overview

Produce, for every endpoint of an interop process package, the exhaustive list of non-500 errors its
error mapper can return, what triggers each one, the wire code the client sees, and whether a real UI
interaction can reach it.

## When to Use

- Building an endpoint/error map for a process (`catalog-process`, `purpose-process`, ...)
- Deciding which error codes the frontend needs to map to a specific message
- Auditing which errors silently fall back to 500

Not for: tracing a single production incident (use systematic-debugging), or documenting request/response
schemas (that is the OpenAPI spec).

## Requirements

**Both repositories must be open in the workspace**: the backend monorepo (`interop-be-monorepo`) _and_ the
frontend (`pdnd-interop-frontend`). The backend alone gives you the errors, their statuses and their codes,
but the "Reachable from the FE?" column cannot be filled from it — that verdict needs the routes, guards,
components and forms, and the monorepo's BFF only tells you half the story.

Check for both before starting. If the frontend is missing, stop and say so rather than guessing at
reachability: produce the four-column map (Error, Code, Status, When it happens) and state that the FE
column was omitted for lack of the repository.

## Inputs

1. The process package name.
2. A list of endpoints, or "the first N endpoints in router order".

Work in **router declaration order**. Endpoints whose mapper is `emptyErrorMapper` have no non-500 errors:
list them once in a note at the top, do not give them a section. Section numbers are consecutive over the
documented sections only — skipped endpoints do not consume a number.

## Output Contract

One section per endpoint. This is the target shape — match it exactly:

```markdown
## 1. `POST /eservices`

Service: `createEService` → `innerCreateEService`. Mapper: `createEServiceErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`, `M2M_ADMIN_ROLE`.

| Error                              | Code       | Status | When it happens                                                                                                   | Reachable from the FE?                                                                                                                                                                    | Steps to reproduce (UI)                                                                                                                                                                                              |
| ---------------------------------- | ---------- | ------ | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `eServiceNameDuplicateForProducer` | `001-007`  | 409    | The requester (producer) already owns an e-service with the same name (`assertEServiceNameAvailableForProducer`). | **CAN HAPPEN** — the name is free text, the FE has no guard on it.                                                                                                                        | **Data precondition:** you are `admin` of tenant A; A already owns an e-service named `N`.<br>1. Go to `/erogazione/e-service/crea/`.<br>2. Type `N` in _Nome dell’e-service_.<br>3. Click _Salva bozza e prosegui_. |
| `originNotCompliant`               | `001-0008` | 403    | The requester tenant's `externalId.origin` is not in `config.producerAllowedOrigins`.                             | Cannot happen — `AuthGuard` blocks all `provider` routes unless `isOrganizationAllowedToProduce` (or `isSupport`, but `support` is not in the `authLevels` of `PROVIDE_ESERVICE_CREATE`). | —                                                                                                                                                                                                                    |
```

Rules for the cells:

- **Error** — the error _code_ (the `code:` field of the `ApiError`), not the factory function name.
- **Code** — copied verbatim from the source maps, never reconstructed. See Wire Codes below.
- **When it happens** — the concrete precondition, naming the assert/helper that raises it. Normally one
  sentence; if one code has several throw sites with different guards, keep **one row** and enumerate them.
- **Reachable from the FE?** — `**CAN HAPPEN** — <why>` or `Cannot happen — <what prevents it>`.
- **Steps to reproduce (UI)** — **only for `CAN HAPPEN` rows**; every `Cannot happen` row gets `—`. Open with
  a `**Data precondition:**` line, then `<br>`-separated numbered steps. See below.

This column asks **"can a normal UI interaction produce this error?"** — not "is it exploitable". A control
the UI never renders, an action it disables, or a value the form normalises all count as `Cannot happen`,
alongside the harder blocks (route `authLevels`, `validateAuthorization` roles, a BFF pre-check that fails
first, a BFF-overwritten field, no throw site at all). Crafted requests, replays and stale tabs are out of
scope: they do not change the verdict. Always name the specific thing that prevents it — the component that
hides the control, the guard, the normalisation — never just "the UI prevents it".

### Steps to Reproduce

The reachability verdict claims the error is reachable; this column is the proof. Write it as something a
tester can execute without reading any code.

**Data precondition** — the state the environment must be in _before_ step 1: the requester's role and tenant,
the tenants and delegations involved, the state of the e-service / agreement / purpose / descriptor, and any
feature flag. Name tenants `A`, `B`, `C` and reuse them in the steps. If no fixture is needed because the
first step creates it, say so explicitly rather than omitting the line.

**Steps** — numbered, starting from a navigable entry point (menu path, or the route path when the page is
not in the nav), and ending with the click that fires the request. Quote UI labels as the user sees them,
taken from the locale files, not from the component's prop names. Call out the step that carries the defect
— the field that is not cleared, the action left enabled, the timing window.

When several rows share one repro, write it out once and have the others reference it, stating only what
differs ("same as `X`, except B also has ..."). That difference is usually the interesting part.

If you cannot write executable steps, the verdict is not `CAN HAPPEN`. Reconsider it rather than filling the
cell with a paraphrase of the mapper.

Add a `>` note under a table for every error thrown inside the flow but **absent from the mapper**. Work out
its real status with the fallback rule below before describing it — unmapped does not automatically mean 500.

## Procedure

1. **Router** — find the endpoint, record its `validateAuthorization` roles (they go in the header line), the
   service method, and the mapper passed to `makeApiProblem`. The roles alone can make errors unreachable for
   whole classes of caller.
2. **Mapper** — list every code in a `.with(...)` arm. Exclude the `.otherwise()` fallback and arms that map
   _explicitly_ to `HTTP_STATUS_INTERNAL_SERVER_ERROR`, but mention the latter in the note.
3. **Service** — read the method top to bottom, plus every helper it calls: `inner*` functions, `validators.ts`,
   `versionGenerator.ts`, and asserts imported from `pagopa-interop-commons` (e.g. `assertFeatureFlagEnabled`
   in `packages/commons/src/config/featureFlagsConfig.ts`). For each mapper entry, find the throw site and its
   guard condition. If there is no reachable throw site, keep the row, mark it **dead mapper entry**, and leave
   the Status cell as the mapper declares it.
4. **Reverse check** — every error the service can throw that is missing from the mapper goes into the note,
   with the status the fallback rule actually produces.
5. **Wire code** — resolve as below.
6. **Frontend** — only if the endpoint is reachable from the UI. Trace in order:
   `route authLevels` → `AuthGuard` → the action that triggers the call (hidden? `disabled`?) → the form
   (field normalisation, forced values) → **the BFF**. The BFF matters twice: it may inject values the FE never
   sends (`toCatalogCreateEServiceSeed` hardcodes the descriptor seed), and it may run the _same validation
   first_ and fail with its own error, making the downstream one unreachable (`retrieveEserviceDescriptor`
   throws the BFF's own `eserviceDescriptorNotFound` before catalog is called).
   To find the call sites: grep the operation name in the FE's `api.generatedTypes.ts`, then the matching
   hook in `*.mutations.ts` / `*.queries.ts`, then that hook's usages.
7. **Repro** — for each `CAN HAPPEN` row, turn the trace from step 6 into the steps. Pick up the UI labels
   from `src/static/locales/it/*.json` and the entry point from `src/router/routes.tsx` while you are there;
   going back for them later costs a second pass over the same files.

## Running It Efficiently

For more than two or three endpoints, dispatch subagents. Endpoints share no state, so:

1. **Do the shared reads once, in the main thread, before dispatching.** Read the router entries, the mappers,
   and the relevant slice of the `errorCodes` map. Paste all three into every subagent prompt. Otherwise each
   subagent re-derives the same wire codes and you pay for the same file three times.
2. **Issue every subagent call in a single block.** Sequential dispatch is the single biggest time sink and it
   buys nothing — nothing in one endpoint's analysis feeds another's.
3. **Batch by shared frontend surface, not by count.** Step 6 dominates the cost, and endpoints driven by the
   same components amortise it: the three `.../documents*` endpoints all resolve through
   `ProviderEServiceDocumentationSection` and `UploadDocumentsSection`, so one subagent covering all three
   traces that tree once. Two endpoints with unrelated FE flows belong in separate subagents even though that
   looks like less parallelism.
4. **Ask for compact output.** Large results get spilled to a temp file and cost an extra round-trip to read
   back. Request the markdown sections only — no preamble, no per-file commentary.
5. **Verify centrally at the end.** One grep of the `errorCodes` map covering every suffix the subagents used
   is cheaper and more reliable than trusting each of them separately.

Give subagents the mapper arms verbatim and tell them every arm must appear as a row — but still require them
to locate each throw site themselves. Handing over the arms saves a read.

## Wire Codes

Built by `makeApiProblemBuilder` in `packages/models/src/errors.ts`:

```ts
code: `${serviceErrorCode}-${allErrors[code]}`;
```

| Part                   | Source                                                                                                                                                                |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Prefix                 | `serviceErrorCode` in `packages/models/src/services.ts` (`001` catalog, `002` agreement, `004` purpose, `005` tenant, `010` delegation, `011` eservice-template, ...) |
| Suffix, service errors | the `errorCodes` map in `<package>/src/model/domain/errors.ts`                                                                                                        |
| Suffix, shared errors  | `commonErrorCodes` in `packages/models/src/errors.ts` (`operationForbidden` → `9989`)                                                                                 |

The BFF builds its problems with `problemErrorsPassthrough: true`, so a downstream `Problem` reaches the
frontend untouched: the prefix is the **originating** service, never `008`.

**Read the suffix from the file. Do not assume it is zero-padded to 4 digits** — `eServiceNameDuplicateForProducer`
is `"007"` in catalog-process, so the wire code is `001-007`. It is currently the only non-padded suffix in that
map, which is exactly why it gets missed. The suffix is an opaque string; nothing enforces its width.

## The 500 Fallback Is Not Terminal

When a service mapper returns 500 (via `.otherwise()`, an explicit 500 arm, or simply not listing the code),
`makeApiProblemBuilder` re-runs `defaultCommonErrorMapper` on the error code:

```ts
const code =
  mappedCode === HTTP_STATUS_INTERNAL_SERVER_ERROR
    ? defaultCommonErrorMapper(error.code as CommonErrorCodes)
    : mappedCode;
```

`defaultCommonErrorMapper` recognises **common** codes only:

| Code                                                                    | Status |
| ----------------------------------------------------------------------- | ------ |
| `badRequestError`, `invalidPdfSignatureError`, `invalidFileUploadError` | 400    |
| `tokenVerificationFailed`                                               | 401    |
| `unauthorizedError`, `operationForbidden`                               | 403    |
| `contentTooLargeError`                                                  | 413    |
| `tooManyRequestsError`                                                  | 429    |
| `featureFlagNotEnabled`                                                 | 501    |
| anything else — including **every service-specific code**               | 500    |

So: an unmapped _service-specific_ error (`eserviceWithActiveOrPendingDelegation`) really is a 500 and is worth
reporting. An unmapped _common_ error is not — `operationForbidden` returns 403 whether or not the mapper lists
it, and `featureFlagNotEnabled` returns 501. Check which kind you are looking at before writing the note.

## Common Mistakes

| Mistake                                                   | Consequence                                                                                                                                                                                                                                                                                                                                                  |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Documenting a mapper entry without finding its throw site | Rows describing behaviour that cannot occur. Dead entries are per-mapper, so re-check for every endpoint: `interfaceAlreadyExists` is dead in `createEServiceInstanceFromTemplateErrorMapper` (that flow only ever passes `kind: "DOCUMENT"` / `"ASYNC_EXCHANGE_CALLBACK_INTERFACE"`) but live in `documentCreateErrorMapper`, which accepts all three kinds |
| Assuming an unmapped error is a 500                       | Wrong status for every common code. See the fallback section                                                                                                                                                                                                                                                                                                 |
| Using the factory function name as the error name         | `notValidDescriptorState()` raises code `notValidDescriptor` — the mapper keys on the code                                                                                                                                                                                                                                                                   |
| Reconstructing a code from memory or a grep snippet       | Wrong codes. Re-open the file at the line and read it                                                                                                                                                                                                                                                                                                        |
| Writing `Cannot happen` without naming what prevents it   | Unverifiable rows. Name the component, guard or normalisation                                                                                                                                                                                                                                                                                                |
| Writing repro steps from component prop names             | Labels that do not exist in the product. `nameField` renders as _Nome dell’e-service_ — read `src/static/locales/it/*.json`, and mind the curly apostrophe                                                                                                                                                                                                   |
| Assuming the FE sends what the API type declares          | The BFF fills in fields (e.g. `toCatalogCreateEServiceSeed` hardcodes `dailyCallsPerConsumer: 1`, `dailyCallsTotal: 10`), which neutralises whole validations                                                                                                                                                                                                |

## Verification Before Handing Over

- Both repositories were present; no reachability verdict was inferred without the frontend.
- Section numbering is consecutive over documented sections, following router order.
- Every mapper `.with()` arm appears as a row, including the ones you concluded are unreachable.
- Every code was read from the source file in this session.
- Each `Cannot happen` names the specific component, guard or normalisation that prevents it.
- Each `CAN HAPPEN` has executable steps with a data precondition; each `Cannot happen` has `—`.
- UI labels in the steps were read from the locale files, not invented from component names.
- Unmapped errors were checked against `defaultCommonErrorMapper` before being called 500s.
