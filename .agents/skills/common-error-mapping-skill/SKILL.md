---
name: common-error-mapping-skill
description: Use when documenting where the common errors defined in packages/models/src/errors.ts (operationForbidden, unauthorizedError, badRequestError, featureFlagNotEnabled, ...) can be thrown by a given pagopa interop backend process, which BFF endpoints expose them, and whether the frontend can actually cause them — building or extending packages/models/COMMON-ERROR-MAPPING.md, one process at a time.
---

# Mapping Common Errors

## Overview

For one interop process package, find every place where a **common** error from
`packages/models/src/errors.ts` can be thrown, follow it up to the BFF endpoints that expose it, and decide
whether a real UI interaction in `pdnd-interop-frontend` can produce it.

The output is grouped **by error code**, not by endpoint. Each error code has one table with one row per
BFF endpoint (per process) where that error can occur. Running the skill for another process adds that
process's rows to the same file.

## When to Use

- Building or extending `packages/models/COMMON-ERROR-MAPPING.md` for a process (`catalog-process`,
  `purpose-process`, ...)
- Deciding which common error codes the frontend needs a specific message for, and on which pages
- Auditing where `operationForbidden`, `unauthorizedError`, `featureFlagNotEnabled`, etc. come from

Not for: service-specific errors of a process (use `error-mapping-skill`), tracing a single production
incident, or documenting request/response schemas.

## Requirements

**Both repositories must be available**: this skill lives in the backend monorepo (`interop-be-monorepo`),
and the frontend is at `../pdnd-interop-frontend` (one level above the monorepo root).

Check for both before starting. If the frontend is missing, **stop and say so**: the "Reachable from the
FE?", "Steps to reproduce (UI)" and "Resolution steps" columns cannot be filled without it, and a guessed
reachability verdict is worse than no row.

## Input

One process package name (e.g. `catalog-process`). One run = one process. Do not process more than one
process per run; the user batches manually by process.

## Step 0 — Classify the common errors

Read `packages/models/src/errors.ts` in full. For every error code it declares, find the constructor
function(s) that produce it (the function name and the `code` string can differ — map them explicitly before
searching for throw sites).

Put each code into exactly one bucket:

| Bucket                    | What goes in it                                                                                                                                                                                                                         | Documented?                         |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| **Authentication**        | Errors raised while authenticating the request, common to every endpoint: token verification failures, missing/invalid authorization headers, missing or invalid JWT claims.                                                            | No — listed in the top note         |
| **Middleware-only**       | Errors that the generic HTTP pipeline raises for any endpoint: request schema validation (zod/zodios), rate limiting, body size limits. **Only when** that generic pipeline is their sole source.                                       | No — listed in the top note         |
| **Infrastructure**        | Errors that never reach an HTTP response as themselves: Kafka, DB, event store, JWKS, internal/generic failures that always surface as 500.                                                                                             | No — listed in the top note         |
| **Documentable**          | Everything else, notably **authorization** errors (`unauthorizedError` from `validateAuthorization` role checks, `operationForbidden` from ownership checks), `featureFlagNotEnabled`, and explicit throws of `badRequestError`, etc.   | Yes — one section each (if thrown)  |

Authorization is **not** authentication: role checks and ownership checks are endpoint-specific and must be
documented.

A code that is middleware-only in general but is **also** thrown explicitly by a service, validator or
endpoint-specific helper (e.g. an explicit `badRequestError(...)` in a validator, an upload helper throwing
`invalidFileUploadError`) is documentable, and only those explicit throw sites get rows.

The classification is process-independent. If the file already has the top note, re-verify it against the
current `errors.ts` (codes may have been added or removed) and update it if needed.

## Step 1 — Generator output

From the monorepo root:

```bash
cd packages/tool-mapping-error-bff-process && npx tsx src/index.ts --process [process-name] --include-frontend --output ../../tmp/common-error-map/[process-name].json
```

Use `output[process-name]`. **Important:** the generator's `mapper.errors[]` lists the service-specific
errors of each mapper; **common errors are not there**. Do not use `mapper.errors[]` to decide which common
errors an endpoint throws — that comes from Step 2.

The generator output **is** authoritative for:

- router order of the process endpoints, their service function and roles;
- `bffEndpoints[]` — the `METHOD path` of each BFF route that calls the process endpoint. Never derive this
  by grepping the BFF router yourself;
- the frontend files where the endpoint is used — the starting point for Step 4.

Process endpoints with an empty `bffEndpoints[]` (M2M, internal-only) are **out of scope**: omit them silently.

## Step 2 — Throw-site index (backend process)

For each documentable code, find every throw site reachable from the process's routes:

- the router file itself (e.g. `validateAuthorization(ctx, [...roles])` calls inside handlers);
- the service methods, `inner*` functions, `validators.ts`, and any other helper they call;
- helpers from `pagopa-interop-commons` invoked along the way (e.g. `assertFeatureFlagEnabled` in
  `packages/commons/src/config/featureFlagsConfig.ts`, `validateAuthorization`).

Search for the **constructor function name**, not only the code string. For each throw site record the guard
condition and which process endpoint(s) reach it.

Watch for errors that are caught and rethrown as something else inside the flow: a throw site whose error
never leaves the service as that code does not count.

If a documentable code has **no** throw site in this process, it gets no rows for this process. If it ends
up with no rows for any process, it has no section at all.

## Step 3 — BFF

For every process endpoint with throw sites, take its `bffEndpoints[]` from the generator. For each BFF
endpoint, read its handler in `packages/backend-for-frontend` and check:

1. **Pre-checks that make the process throw unreachable** — the BFF may run the same validation first and
   fail with its own error, so the process never gets to throw.
2. **Values the BFF injects or overwrites** — a field the FE cannot influence can neutralise the guard.
3. **Common errors the BFF throws itself** in that handler before or after calling the process (e.g. its own
   `operationForbidden` checks). These also get rows for that BFF endpoint; say in "When it happens" that the
   throw site is in the BFF.

Only BFF endpoints listed in the generator output for this process are in scope.

## Step 4 — Frontend

For each BFF endpoint row, trace in `../pdnd-interop-frontend`, in order:

`route authLevels` (`src/router/routes.tsx`) → `AuthGuard` → the action that fires the call (rendered?
`disabled`? hidden for this role/state?) → the form (normalisation, forced values) → the BFF call.

To find call sites, start from the frontend files in the generator output; otherwise grep the operation in
`api.generatedTypes.ts`, then the hook in `*.mutations.ts` / `*.queries.ts`, then the hook's usages.

For authorization errors, compare the process roles / ownership condition with what the FE route and
component allow: a role that cannot reach the route, or a button rendered only for the owner, is a
`Cannot happen`.

## Step 5 — Repro and resolution

For every `CAN HAPPEN` row, turn the Step 4 trace into executable steps, using labels from
`src/static/locales/it/*.json` and entry points from `src/router/routes.tsx` (pick them up during Step 4).

## Output Contract

Write or update:

```text
packages/models/COMMON-ERROR-MAPPING.md
```

### File structure

```markdown
# Common errors mapping

> **Not documented** (same for every endpoint, or never surfaced over HTTP):
> - Authentication: `codeA`, `codeB`, ...
> - Middleware-only: `codeC`, ...
> - Infrastructure: `codeD`, ...
>
> Processes covered: `catalog-process`, `purpose-process`.

## `operationForbidden`

<one-line description of the error, from errors.ts>

| Process | BFF endpoint | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ------- | ------------ | --------------- | ---------------------- | ----------------------- | ---------------- |
| ...     | ...          | ...             | ...                    | ...                     | ...              |

## `unauthorizedError`

...
```

- Sections follow the **declaration order of `errors.ts`**. Use the error code as declared there as the
  heading.
- Rows are ordered by process name, then by the process endpoints' router order (generator order), then by
  `bffEndpoints[]` array order.
- **One row per (process, BFF endpoint)**. Do not merge rows across BFF endpoints, and do not write "same as
  X" references: every row is written out in full, even when two rows are almost identical.
- If one BFF endpoint reaches the same code through several throw sites (or several process endpoints),
  keep **one row** and enumerate the throw sites in "When it happens".
- There is no Status column.

### Updating an existing file

- Remove **all rows** whose Process is the current process, in every section, then add the new rows.
- Leave rows of other processes untouched.
- Add new sections in `errors.ts` order; remove sections left with no rows.
- Update the "Processes covered" list and re-verify the bucket note (Step 0).

### Example (illustrative shape only — do not copy the content)

```markdown
## `operationForbidden`

Insufficient privileges for the requested operation.

| Process           | BFF endpoint                       | When it happens                                                                                                  | Reachable from the FE?                                                                                                     | Steps to reproduce (UI)                                                                                                                                                                                                                       | Resolution steps                                                                                                    |
| ----------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `catalog-process` | `DELETE /bff/eservices/{eServiceId}` | The requester is not the producer of the e-service (`assertRequesterAllowed` in `deleteEService`).              | Cannot happen — the delete action is rendered only in the provider's e-service list, which lists only the requester's own e-services. | —                                                                                                                                                                                                                                             | —                                                                                                                   |
| `catalog-process` | `POST /bff/eservices/{eServiceId}/descriptors/{descriptorId}/publish` | The requester is a delegate producer whose delegation was revoked after the page was loaded (`assertRequesterIsDelegateProducerOrProducer`). | **CAN HAPPEN** — the page does not re-check the delegation state before enabling _Pubblica_. | **Data precondition:** you are `admin` of tenant B; B is delegate producer of A's e-service `E`, with a draft descriptor.<br>1. Go to `/erogazione/e-service/`.<br>2. Open `E`.<br>3. In another session, A revokes the delegation.<br>4. Back in B's session, click _Pubblica_ **without reloading** — the button is still enabled. | 🟡 Medium resolution<br>1. Reload the page.<br>2. Ask tenant A to grant the delegation again if B must keep operating `E`. |
```

### Rules for the cells

- **Process** — the process package name, in backticks.
- **BFF endpoint** — `METHOD path` copied verbatim from the generator's `bffEndpoints[]`.
- **When it happens** — the concrete precondition, naming the assert/helper/check that raises it and the
  service function it is in. If the throw site is in the BFF, say so. Several throw sites for the same row →
  enumerate them.
- **Reachable from the FE?** — `**CAN HAPPEN** — <why>`, `**CAN HAPPEN (UNVERIFIED)** — <what is uncertain>`,
  or `Cannot happen — <what prevents it>`.
- **Steps to reproduce (UI)** — only for `CAN HAPPEN` / `CAN HAPPEN (UNVERIFIED)` rows; `Cannot happen` rows
  get `—`.
- **Resolution steps** — only for `CAN HAPPEN` / `CAN HAPPEN (UNVERIFIED)` rows; `Cannot happen` rows get `—`.

### Reachability

The column asks **"can a normal UI interaction produce this error?"** — not "is it exploitable". A control
the UI never renders, an action it disables, a value the form normalises, a route whose `authLevels` exclude
the role, a BFF pre-check that fails first, a BFF-overwritten field, all count as `Cannot happen`. Crafted
requests, replays and stale tabs opened with deliberate intent are out of scope. Always name the specific
thing that prevents it — the component, the guard, the normalisation — never just "the UI prevents it".

A legitimate timing window that a normal user can hit (state changed by another tenant/user while the page is
open, without a reload) **is** a normal UI interaction and can be `CAN HAPPEN`.

If you are not entirely sure (complex or ambiguous FE code), use **CAN HAPPEN (UNVERIFIED)**. In its steps:

- do not invent UI steps or assume fields are editable without checking;
- state explicitly what needs manual verification (e.g. "Unverified: check whether component X disables
  _Pubblica_ for delegate producers").

### Steps to reproduce

Written so a tester can execute them without reading code.

- **Data precondition** — the state before step 1: the requester's role and tenant, the tenants and
  delegations involved, the state of the e-service / agreement / purpose / descriptor, any feature flag.
  Name tenants `A`, `B`, `C`. If the first step creates the fixture, say so explicitly.
- **Steps** — numbered, `<br>`-separated, starting from a navigable entry point (menu path, or route path
  when the page is not in the nav), ending with the click that fires the request. Quote UI labels as shown
  to the user, taken from `src/static/locales/it/*.json` (mind the curly apostrophe). Call out the step that
  carries the defect.

If you cannot write executable steps, the verdict is not `CAN HAPPEN` — reconsider it.

### Resolution steps

Only for errors that can occur. Start with the difficulty, then numbered steps:

- 🟢 **Easy resolution** — e.g. reloading the page.
- 🟡 **Medium resolution** — more involved steps the user can do (changing input, asking another tenant to
  act, enabling a configuration — give the exact config key and value).
- 🔴 **Impossible resolution** — needs external intervention (support, backend fix); state why no
  user-side resolution exists.

## Common Mistakes

| Mistake                                                              | Consequence                                                                                                                  |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Using the generator's `mapper.errors[]` to find common errors         | Empty or wrong results — common errors are not listed there. Find throw sites in the code                                    |
| Searching only for the code string                                   | Missed throw sites — the constructor function name can differ from the code                                                  |
| Treating `unauthorizedError` / `operationForbidden` as authentication | Whole sections missing. Authorization checks are endpoint-specific and must be documented                                   |
| Excluding `badRequestError` everywhere                               | Explicit validator throws are lost. Only the generic request-validation source is excluded                                   |
| Including process endpoints with no BFF caller                       | Rows with no BFF endpoint. Omit them                                                                                         |
| Merging rows or writing "same as X"                                   | Violates the contract — every (process, BFF endpoint) row is written in full                                                 |
| Writing `Cannot happen` without naming what prevents it               | Unverifiable rows. Name the route `authLevels`, component, guard or normalisation                                            |
| Ignoring the BFF                                                     | Wrong verdicts — the BFF may fail first, inject values, or throw the common error itself                                     |
| Writing repro labels from component prop names                       | Labels that do not exist in the product. Read the locale files                                                               |
| Touching other processes' rows on update                             | Data loss. Only replace rows whose Process is the current one                                                                |

## Verification Before Handing Over

- Both repositories were present; no reachability verdict was inferred without the frontend.
- Every code in `errors.ts` is either in the top note's buckets or was searched for throw sites in this process.
- Every documentable code thrown by this process has a row for every in-scope BFF endpoint that reaches it.
- No process endpoint with an empty `bffEndpoints[]` produced a row.
- BFF endpoints are copied verbatim from the generator output.
- One row per (process, BFF endpoint); no merged rows, no "same as" references; no Status column.
- Each `Cannot happen` names the specific thing that prevents it and has `—` in the last two columns.
- Each `CAN HAPPEN` has a data precondition, executable steps and resolution steps with a difficulty level.
- UI labels come from the locale files.
- Rows of other processes were left untouched; sections are in `errors.ts` order; empty sections removed.