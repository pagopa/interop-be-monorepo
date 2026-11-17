---
name: check-skill
description: Use when documenting which errors an endpoint of a pagopa interop backend process can return, what triggers each one, and whether the frontend can actually cause it — building or extending an endpoint/error map table.
---

# Mapping Endpoint Errors

## Overview

Produce, for every endpoint of an interop process package, the exhaustive list of non-500 errors its
error mapper can return, what triggers each one, and whether a real UI interaction can reach it.

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
reachability: produce the four-column map (Error, Status, When it happens, Reachable from the FE?) and state that the FE
column was omitted for lack of the repository.

## Inputs

An array of strings, one per endpoint, in the form `` `router`: `METHOD /path` ``, for example:

```text
[
  "`agreementRouter`: `DELETE /agreements/{agreementId}`",
  "`agreementRouter`: `GET /agreements/{agreementId}/contract`",
  "`agreementRouter`: `POST /agreements/{agreementId}/update`",
  "`agreementRouter`: `POST /agreements/{agreementId}/upgrade`"
]
```

Each string names a **BFF router** (`` `agreementRouter` `` → `packages/backend-for-frontend/src/routers/agreementRouter.ts`).
Process them in array order. The route is the entry point the FE calls. Follow its service call to the downstream
process endpoint (e.g. `agreementProcessClient.deleteAgreement` → `packages/agreement-process`) and document the
process errors in their own sub-table. The BFF forwards process `Problem` responses with their original status
(`problemErrorsPassthrough`), so the process mapper's statuses apply. BFF-originated errors come from the BFF's own
mapper; a route with `emptyErrorMapper` has no BFF-originated errors.

Locate each endpoint by reading the source directly (no generator is available):

- **BFF route** — `packages/backend-for-frontend/src/routers/[Router].ts`: the method, path, and the service call.
- **BFF service** — `packages/backend-for-frontend/src/services/*.ts`: the call into the process client and any BFF throw sites.
- **Process endpoint** — `packages/[process-name]-process/src/routers/[Router].ts`: roles and the service handler it calls.
- **Mapper** — the `makeApiProblem(error, [mapperName], ctx)` call identifies the mapper. Its error list lives in
  `packages/[process-name]-process/src/utilities/errorMappers.ts` (or `packages/backend-for-frontend/src/utilities/errorMappers.ts` for BFF errors).

**CRITICAL Execution Strategy (Batching):** 
To prevent context saturation and avoid false positive UI hallucinations, **do NOT analyze all endpoints in a single mental pass**. 
Process the input array in **batches of 3 to 5 endpoints at a time**.

The mapper's error map is authoritative for the `Error` and `Status` columns. Each entry in the mapper has the shape
`{ code: number, message: string }`, where `message` is the error key and `code` the HTTP status (read it from the
mapper's `match`/`.with(...)` arms or its explicit status). For example, `delegationNotFound` mapped to `404` becomes
`delegationNotFound | 404`. Never write `TODO` in either column, swap these fields, infer the status from the service
flow, or replace `message` with its human-readable description. Include every mapper entry, including entries that
are later identified as dead mapper entries.

Keep the endpoints in the order of the input array. Endpoints whose mapper is `emptyErrorMapper` have no non-500
errors: list them once in a note at the top, do not give them a section. Section numbers are consecutive over the
documented sections only — skipped endpoints do not consume a number.

## Output Contract

Write or update, in the root of the monorepo:

```text
CHECKED-PROCESS-ENDPOINT.md
```

Preserve unrelated existing sections, avoid duplicate endpoint sections, and keep sections in input order.

One section per endpoint. This is the target shape — match it exactly:

```markdown
## 1. `POST /eservices`

Service: `createEService` → `innerCreateEService`. Mapper: `createEServiceErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`, `M2M_ADMIN_ROLE`.

| Error                             | Status | When it happens                                                                                                   | Reachable from the FE?                                                                                                                                                                    | Steps to reproduce (UI)                                                                                                                                                                                              | Resolution steps                                        |
| --------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | --- |
| `createEServiceNameConflict`      | 409    | The requester (producer) already owns an e-service with the same name (`assertEServiceNameAvailableForProducer`). | **CAN HAPPEN** — the name is free text, the FE has no guard on it.                                                                                                                        | **Data precondition:** you are `admin` of tenant A; A already owns an e-service named `N`.<br>1. Go to `/erogazione/e-service/crea/`.<br>2. Type `N` in _Nome dell’e-service_.<br>3. Click _Salva bozza e prosegui_. | 🟢 Easy resolution <br />1. The user refreshes the page |
| `organizationNotAllowedToProduce` | 403    | The requester tenant's `externalId.origin` is not in `config.producerAllowedOrigins`.                             | Cannot happen — `AuthGuard` blocks all `provider` routes unless `isOrganizationAllowedToProduce` (or `isSupport`, but `support` is not in the `authLevels` of `PROVIDE_ESERVICE_CREATE`). | —                                                                                                                                                                                                                    | —                                                       |     |
```

Rules for the cells:

- **Error / Status** — copied verbatim from the mapper's error map in `errorMappers.ts` (`message` and `code`).
  Never reconstructed, swapped, or inferred from the service flow.
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

If you are not entirely sure whether the error can actually happen through the UI (e.g. because the FE code is complex or ambiguous), mark it as **CAN HAPPEN (UNVERIFIED)**. 

In the "Steps to reproduce" column:
- DO NOT invent UI steps or assume form fields are editable without checking.
- State explicitly what needs manual verification (e.g. "Unverified: check if component X enforces client-side validation on field Y").

## Resolution steps

Each documented error must have clear and actionable resolution steps.

The resolution steps should include:

```text
🟢 Easy resolution
1. ...
2. ...
3. ...
```

For instance, if a resolution step involves changing a configuration, provide the exact configuration key and value to be modified; if a resolution steps involves simply reloading the page, specify that clearly.

There may be some cases where no resolution is possible; in such cases, clearly state the reason why a resolution cannot be provided.

Provide also a level of difficulty for the resolution as a whole:

```text
🟢 Easy resolution
🟡 Medium resolution
🔴 Impossible resolution
```

Where Easy would be for simply reloading the page, for instance; Medium would be for more involved steps (like changing configuration settings or updating input fields); Impossible would be when no resolution is possible and can only be solved by external intervention (e.g., contacting support or waiting for a backend fix).

These steps must be present only for errors that can actually occur; do not document impossible errors except to mark them as such.

## Procedure

## Procedure

Process the endpoints from the input array in **batches of 3 to 5 endpoints at a time** to ensure thorough tracing and avoid context saturation. Complete steps 1–5 for the current batch before reading the next set of endpoints.

1. **Router and mapper** — for the current batch, read the route in `src/routers/[Router].ts` for the method, path, roles and service; then read the mapper named in its `makeApiProblem` call from `src/utilities/errorMappers.ts` for every error entry (`Error` / `Status` columns).
2. **Service** — read the method top to bottom, plus every helper it calls: `inner*` functions, `validators.ts`, `versionGenerator.ts`, and asserts imported from `pagopa-interop-commons` (e.g. `assertFeatureFlagEnabled` in `packages/commons/src/config/featureFlagsConfig.ts`). For each mapper error entry, find the throw site and its guard condition. If there is no reachable throw site, keep the row, mark it **dead mapper entry**.
3. **Reverse check** — every error the service can throw that is missing from the mapper's error list goes into the note, with the status the fallback rule actually produces (see below).
4. **Frontend** — only if the endpoint is reachable from the UI. Trace in order: `route authLevels` → `AuthGuard` → the action that triggers the call (hidden? `disabled`?) → the form (field normalisation, forced values) → **the BFF**. The BFF matters twice: it may inject values the FE never sends (`toCatalogCreateEServiceSeed` hardcodes the descriptor seed), and it may run the _same validation first_ and fail with its own error, making the downstream one unreachable (`retrieveEserviceDescriptor` throws the BFF's own `eserviceDescriptorNotFound` before catalog is called).
   To find the call sites: grep the operation name in the FE's `api.generatedTypes.ts`, then the matching hook in `*.mutations.ts` / `*.queries.ts`, then that hook's usages.
5. **Repro** — for each `CAN HAPPEN` row, turn the trace from step 4 into the steps. Pick up the UI labels from `src/static/locales/it/*.json` and the entry point from `src/router/routes.tsx` while you are there; going back for them later costs a second pass over the same files.

## The 500 Fallback Is Not Terminal

When a service mapper returns 500 (via `.otherwise()`, an explicit 500 arm, or simply not listing the code),
`makeApiProblemBuilder` re-runs `defaultCommonErrorMapper` on the error code. `defaultCommonErrorMapper`
recognises **common** codes only:

| Code                                                                    | Status |
| ----------------------------------------------------------------------- | ------ |
| `badRequestError`, `invalidPdfSignatureError`, `invalidFileUploadError` | 400    |
| `tokenVerificationFailed`                                               | 401    |
| `unauthorizedError`, `operationForbidden`                               | 403    |
| `contentTooLargeError`                                                  | 413    |
| `tooManyRequestsError`                                                  | 429    |
| `featureFlagNotEnabled`                                                 | 501    |
| anything else — including **every service-specific code**               | 500    |

So: an unmapped _service-specific_ error is really a 500 and is worth reporting. An unmapped _common_ error is
not — `operationForbidden` returns 403 whether or not the mapper lists it, and `featureFlagNotEnabled` returns 501. Check which kind you are looking at before writing the note.

## Common Mistakes

| Mistake                                                            | Consequence                                                                                                                                                   |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Documenting a mapper error entry without finding its throw site    | Rows describing behaviour that cannot occur. Dead entries are per-mapper, so re-check for every endpoint                                                      |
| Assuming an unmapped error is a 500                                | Wrong status for every common code. See the fallback section                                                                                                  |
| Writing `Cannot happen` without naming what prevents it            | Unverifiable rows. Name the component, guard or normalisation                                                                                                 |
| Writing repro steps from component prop names                      | Labels that do not exist in the product. `nameField` renders as _Nome dell'e-service_ — read `src/static/locales/it/*.json`, and mind the curly apostrophe    |
| Assuming the FE sends what the API type declares                   | The BFF fills in fields (e.g. `toCatalogCreateEServiceSeed` hardcodes `dailyCallsPerConsumer: 1`, `dailyCallsTotal: 10`), which neutralises whole validations |

## Verification Before Handing Over

- Both repositories were present; no reachability verdict was inferred without the frontend.
- Section numbering is consecutive over documented sections, following router order.
- Every mapper entry in `errorMappers.ts` appears as a row, including the ones you concluded are unreachable.
- Each `Cannot happen` names the specific component, guard or normalisation that prevents it.
- Each `CAN HAPPEN` has executable steps with a data precondition; each `Cannot happen` has `—`.
- UI labels in the steps were read from the locale files, not invented from component names.
- Unmapped errors were checked against `defaultCommonErrorMapper` before being called 500s.
  | `organizationNotAllowedToProduce` | 403 | The requester tenant's `externalId.origin` is not in `config.producerAllowedOrigins`. | Cannot happen — `AuthGuard` blocks all `provider` routes unless `isOrganizationAllowedToProduce` (or `isSupport`, but `support` is not in the `authLevels` of `PROVIDE_ESERVICE_CREATE`). | — |