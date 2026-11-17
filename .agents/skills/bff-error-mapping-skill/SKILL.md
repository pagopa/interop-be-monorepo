---
name: bff-error-mapping-skill
description: Use when documenting where the errors defined in packages/backend-for-frontend/src/model/errors.ts can be thrown by the backend-for-frontend (BFF) of pagopa interop, which BFF endpoints expose them, and whether the frontend can actually cause them — building or extending packages/backend-for-frontend/BFF-ERROR-MAPPING.md, one BFF router at a time.
---

# Mapping BFF Errors

## Overview

For one BFF router, find every place where an error from
`packages/backend-for-frontend/src/model/errors.ts` can be thrown, identify the BFF endpoints that reach it,
and decide whether a real UI interaction in `pdnd-interop-frontend` can produce it.

The output is grouped **by error code**, not by endpoint. Each error code has one table with one row per
BFF endpoint where that error can occur. Running the skill for another router adds that router's rows to the
same file.

## When to Use

- Building or extending `packages/backend-for-frontend/BFF-ERROR-MAPPING.md` for a BFF router
- Deciding which BFF error codes the frontend needs a specific message for, and on which pages
- Auditing where BFF-specific errors come from

Not for: errors thrown by the backend processes (use `error-mapping-skill`), common errors from
`packages/models/src/errors.ts` (use `common-error-mapping-skill`), tracing a single production incident, or
documenting request/response schemas.

## Requirements

**Both repositories must be available**: this skill lives in the backend monorepo (`interop-be-monorepo`),
and the frontend is at `../pdnd-interop-frontend` (one level above the monorepo root).

Check for both before starting. If the frontend is missing, **stop and say so**: the "Reachable from the
FE?", "Steps to reproduce (UI)" and "Resolution steps" columns cannot be filled without it, and a guessed
reachability verdict is worse than no row.

## Input

One BFF router: the name of a router file under `packages/backend-for-frontend/src/routers/`
(e.g. `catalogRouter`). One run = one router. Do not process more than one router per run; the user batches
manually by router.

If the given name matches no router file, list the router files that exist and stop.

## Step 0 — Classify the BFF errors

Read `packages/backend-for-frontend/src/model/errors.ts` in full. For every error code it declares, find the
constructor function(s) that produce it (the function name and the `code` string can differ — map them
explicitly before searching for throw sites).

Put each code into exactly one bucket:

| Bucket             | What goes in it                                                                                                                                                                                                                | Documented?                        |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------- |
| **Authentication** | Errors raised while authenticating **every** request (e.g. in a middleware that verifies the session token before any handler runs).                                                                                           | No — listed in the top note        |
| **Infrastructure** | Errors that never reach an HTTP response as themselves: configuration, storage/file-manager, internal failures that always surface as 500.                                                                                    | No — listed in the top note        |
| **Unused**         | Codes with no throw site anywhere in `packages/backend-for-frontend/src`.                                                                                                                                                      | No — listed in the top note        |
| **Documentable**   | Everything else, including errors raised by **specific** endpoints of the authentication flow (e.g. the session/token exchange endpoint): those are endpoint-specific and the user can hit them while logging in.              | Yes — one section each (if thrown) |

The classification is router-independent. If the file already has the top note, re-verify it against the
current `errors.ts` (codes may have been added or removed) and update it if needed.

## Step 1 — Endpoint list

Read the router file and list its endpoints in **declaration order**: `METHOD path` (with the BFF path prefix,
as the frontend calls it), the handler, and the service function(s) it calls.

Every endpoint declared in the router is in scope. Do not use `tool-mapping-error-bff-process` for this:
it is organised by process and does not cover BFF-only logic.

## Step 2 — Throw-site index (BFF)

For each documentable code, find every throw site reachable from the router's handlers:

- the router file itself (inline checks in handlers);
- the BFF service functions the handlers call, and every helper they call — including shared helpers in
  other BFF modules (e.g. a `retrieve*` helper that throws a `*NotFound` error used by several services);
- converters / mappers (`api*Converter`, `to*Seed`, ...) that can throw while transforming a process
  response or the request body.

Search for the **constructor function name**, not only the code string. For each throw site record the guard
condition and which endpoint(s) reach it. A shared helper is reached by every endpoint whose handler calls
it, directly or indirectly — trace all callers.

Watch for errors that are caught and rethrown as something else, or caught and swallowed: a throw site whose
error never leaves the handler as that code does not count.

Note when a throw site depends on data returned by a backend process (e.g. "the descriptor is not in the
e-service returned by catalog-process"): the precondition is about that process's data, and the repro must
build it.

If a documentable code has **no** throw site reachable from this router, it gets no rows for this router.
If it ends up with no rows for any router, it has no section at all.

## Step 3 — Frontend

For each endpoint with throw sites, trace in `../pdnd-interop-frontend`, in order:

`route authLevels` (`src/router/routes.tsx`) → `AuthGuard` → the action that fires the call (rendered?
`disabled`? hidden for this role/state?) → the form (normalisation, forced values) → the BFF call.

To find call sites: grep the BFF operation in the FE's `api.generatedTypes.ts`, then the hook in
`*.mutations.ts` / `*.queries.ts`, then the hook's usages. If the operation has no FE call site at all, every
row of that endpoint is `Cannot happen — no FE call site for <operation>`.

Pay attention to errors that depend on the IDs the FE puts in the path or body: check where those IDs come
from (a list the FE just fetched, a URL param the user can land on from a link, a selection in a form) before
deciding the mismatch cannot happen.

## Step 4 — Repro and resolution

For every `CAN HAPPEN` row, turn the Step 3 trace into executable steps, using labels from
`src/static/locales/it/*.json` and entry points from `src/router/routes.tsx` (pick them up during Step 3).

## Output Contract

Write or update:

```text
packages/backend-for-frontend/BFF-ERROR-MAPPING.md
```

### File structure

```markdown
# BFF errors mapping

> **Not documented**:
> - Authentication: `codeA`, ...
> - Infrastructure: `codeB`, ...
> - Unused (no throw site in the BFF): `codeC`, ...
>
> Routers covered: `catalogRouter`, `purposeRouter`.

## `eserviceDescriptorNotFound`

<one-line description of the error, from errors.ts>

| Router | BFF endpoint | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ------ | ------------ | --------------- | ---------------------- | ----------------------- | ---------------- |
| ...    | ...          | ...             | ...                    | ...                     | ...              |

## `...`

...
```

- Sections follow the **declaration order of `errors.ts`**. Use the error code as declared there as the
  heading.
- Rows are ordered by router name, then by endpoint declaration order in the router.
- **One row per (router, BFF endpoint)**. Do not merge rows across endpoints, and do not write "same as X"
  references: every row is written out in full, even when two rows are almost identical.
- If one endpoint reaches the same code through several throw sites, keep **one row** and enumerate the
  throw sites in "When it happens".
- There is no Status column.

### Updating an existing file

- Remove **all rows** whose Router is the current router, in every section, then add the new rows.
- Leave rows of other routers untouched.
- Add new sections in `errors.ts` order; remove sections left with no rows.
- Update the "Routers covered" list and re-verify the bucket note (Step 0). A code moves out of "Unused" as
  soon as any throw site exists, even in a router not yet covered.

### Example (illustrative shape only — do not copy the content)

```markdown
## `eserviceDescriptorNotFound`

Descriptor not found in the e-service.

| Router          | BFF endpoint                                                  | When it happens                                                                                                                                          | Reachable from the FE?                                                                                              | Steps to reproduce (UI) | Resolution steps |
| --------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------- | ---------------- |
| `catalogRouter` | `GET /eservices/{eServiceId}/descriptors/{descriptorId}`      | The `descriptorId` is not among the descriptors of the e-service returned by catalog-process (`retrieveEserviceDescriptor` in `getProducerEServiceDescriptor`). | Cannot happen — the page builds the URL from the descriptor list of the same e-service, fetched just before.        | —                       | —                |
```

### Rules for the cells

- **Router** — the router name, in backticks.
- **BFF endpoint** — `METHOD path` as declared in the router (and as called by the FE).
- **When it happens** — the concrete precondition, naming the check/helper that raises it and the service
  function it is in. Several throw sites for the same row → enumerate them.
- **Reachable from the FE?** — `**CAN HAPPEN** — <why>`, `**CAN HAPPEN (UNVERIFIED)** — <what is uncertain>`,
  or `Cannot happen — <what prevents it>`.
- **Steps to reproduce (UI)** — only for `CAN HAPPEN` / `CAN HAPPEN (UNVERIFIED)` rows; `Cannot happen` rows
  get `—`.
- **Resolution steps** — only for `CAN HAPPEN` / `CAN HAPPEN (UNVERIFIED)` rows; `Cannot happen` rows get `—`.

### Reachability

The column asks **"can a normal UI interaction produce this error?"** — not "is it exploitable". A control
the UI never renders, an action it disables, a value the form normalises, a route whose `authLevels` exclude
the role, an ID the FE always takes from data it just fetched, all count as `Cannot happen`. Crafted
requests, replays and stale tabs opened with deliberate intent are out of scope. Always name the specific
thing that prevents it — the component, the guard, the normalisation — never just "the UI prevents it".

A legitimate timing window that a normal user can hit (state changed by another tenant/user while the page is
open, without a reload) **is** a normal UI interaction and can be `CAN HAPPEN`. So is a link the product
itself produces (e.g. in a notification or an email) that can point to data that no longer exists.

If you are not entirely sure (complex or ambiguous FE code), use **CAN HAPPEN (UNVERIFIED)**. In its steps:

- do not invent UI steps or assume fields are editable without checking;
- state explicitly what needs manual verification (e.g. "Unverified: check whether component X refetches the
  descriptor list before navigating").

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

| Mistake                                                | Consequence                                                                                                       |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| Searching only for the code string                     | Missed throw sites — the constructor function name can differ from the code                                       |
| Looking only at the service the handler calls directly | Missed throw sites in shared helpers and converters. Trace every helper and all its callers                       |
| Excluding every authentication-related error           | Login-flow errors lost. Only errors raised for every request are excluded; token-exchange errors are documentable |
| Ignoring caught-and-rethrown errors                    | Rows for errors that never leave the handler as that code                                                         |
| Assuming an ID mismatch cannot happen                  | Wrong verdicts. Check where the FE takes the ID from (fresh list, URL param, product links)                        |
| Merging rows or writing "same as X"                    | Violates the contract — every (router, endpoint) row is written in full                                           |
| Writing `Cannot happen` without naming what prevents it | Unverifiable rows. Name the route `authLevels`, component, guard or normalisation                                |
| Writing repro labels from component prop names         | Labels that do not exist in the product. Read the locale files                                                    |
| Touching other routers' rows on update                 | Data loss. Only replace rows whose Router is the current one                                                      |

## Verification Before Handing Over

- Both repositories were present; no reachability verdict was inferred without the frontend.
- Every code in `errors.ts` is either in the top note's buckets or was searched for throw sites in this router.
- Every documentable code reachable from this router has a row for every endpoint that reaches it.
- One row per (router, endpoint); no merged rows, no "same as" references; no Status column.
- Each `Cannot happen` names the specific thing that prevents it and has `—` in the last two columns.
- Each `CAN HAPPEN` has a data precondition, executable steps and resolution steps with a difficulty level.
- UI labels come from the locale files.
- Rows of other routers were left untouched; sections are in `errors.ts` order; empty sections removed.
