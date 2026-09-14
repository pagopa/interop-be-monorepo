---
name: do-things-with-endpoints
description: Generate and maintain complete endpoint documentation, endpoint error mappings, and BFF endpoint mappings for a process package in interop-be-monorepo. Use when asked to fully document a backend process.
argument-hint: "[process-name]"
# tools: ['vscode', 'execute', 'read', 'agent', 'edit', 'search', 'web', 'todo'] # specify the tools this agent can use. If not set, all enabled tools are allowed.
---

# Generate Process Documentation

Fully document a backend process in `interop-be-monorepo`.

The process documentation consists of three stages:

1. Generate the complete endpoint list.
2. Generate the endpoint/error mapping.
3. Enrich the endpoint/error documentation with the BFF endpoints that can reach each process endpoint.

You are responsible for completing the entire workflow. Do not report the process as fully documented until all applicable stages have been completed and validated.

## Input

The user provides a process name, for example:

- `catalog`
- `agreement`
- `tenant`

The process package is:

```text
interop-be-monorepo/packages/<process-name>-process/
```

If the user provides a value ending in `-process`, normalize it by removing the suffix for the purposes of this workflow.

For example:

```text
catalog
catalog-process
```

both refer to:

```text
packages/catalog-process/
```

If no process name is provided, ask for it.

## Required repositories

The backend repository must be available in the workspace:

```text
interop-be-monorepo/
```

The frontend repository is also required for endpoint error mapping because frontend reachability must be determined from the actual frontend code.

The frontend repository is expected to be:

```text
pdnd-interop-frontend/
```

Before starting the error-mapping stage, verify that both repositories are available.

If the frontend repository is missing, stop the workflow with an error.

Do not guess frontend reachability.

## Output files

The workflow produces:

```text
interop-be-monorepo/packages/<process-name>-process/ENDPOINTS.md
interop-be-monorepo/packages/<process-name>-process/ENDPOINT-ERRORS.md
```

The final BFF enrichment is written into `ENDPOINT-ERRORS.md`.

---

# Stage 1 — Generate the endpoint list

Ensure that:

```text
packages/<process-name>-process/ENDPOINTS.md
```

exists and represents the current router state.

Only regenerate it when needed.

### When regeneration is needed

Regenerate `ENDPOINTS.md` if:

- it does not exist;
- the endpoint list is required for the current workflow and cannot be trusted to represent the current routers;
- the user explicitly asks to regenerate endpoint documentation.

When regeneration is required, inspect every relevant file under:

```text
packages/<process-name>-process/src/routers/
```

and generate the complete endpoint list.

Routes must be identified from the router declarations themselves.

Inspect all router files, not just one.

Extract:

- HTTP method
- effective route path

Preserve route syntax exactly as defined by the process router, including parameters such as `:eServiceId`.

If a router prefix is defined outside the individual route declaration, determine the effective endpoint path when this can be done reliably.

Do not invent endpoints from service methods, OpenAPI specifications, tests, or other sources.

The generated file must have this structure:

```markdown
**# <process-name>-process**

**## 1. `POST /some/path`**

TODO

**## 2. `GET /another/path`**

TODO
```

There must be exactly one `TODO` immediately below every endpoint heading.

Do not add other content.

If no routes can be found, stop with an error rather than creating a misleading document.

Avoid duplicate method/path combinations.

Order endpoints deterministically, preferably by router declaration order, with multiple router files processed in lexicographical filename order.

Do not modify router source files.

---

# Stage 2 — Generate endpoint error documentation

The goal of this stage is to produce:

```text
packages/<process-name>-process/ENDPOINT-ERRORS.md
```

containing the exhaustive non-500 error mapping for every process endpoint.

The detailed rules for this stage are defined by the `mapping-endpoint-errors` workflow and must be followed in full.

## Endpoint source of truth

Use:

```text
packages/<process-name>-process/ENDPOINTS.md
```

as the authoritative list of process endpoints.

Identify endpoints by their:

```text
HTTP method + route path
```

Do not use section numbers as endpoint identifiers.

For example:

```text
POST /eservices
```

is the identity of the endpoint regardless of whether it is section 1, 5, or 20.

## Existing ENDPOINT-ERRORS.md

If `ENDPOINT-ERRORS.md` does not exist, create it.

If it already exists:

1. Read the existing documentation.
2. Identify which endpoints are already documented.
3. Compare those endpoints with `ENDPOINTS.md`.
4. Process only the endpoints that are not yet documented.
5. Preserve the existing documentation.

Do not redo already documented endpoints merely because the workflow is being resumed.

Endpoint removal or reconciliation of obsolete documentation is a manual operation and must not be performed automatically.

This makes the error-mapping stage resumable.

For example:

```text
ENDPOINTS.md
    1. POST /foo
    2. POST /bar
    3. POST /baz

ENDPOINT-ERRORS.md
    POST /foo
    POST /baz
```

means that only:

```text
POST /bar
```

needs to be processed.

## Processing batches

The endpoint error analysis can be expensive.

When there are more than two or three endpoints to process, use subagents when beneficial.

Do not blindly create one subagent per endpoint.

Prefer grouping endpoints that share the same frontend surface or code paths, because frontend analysis is usually the most expensive part of the workflow.

Shared information such as:

- router definitions;
- mapper definitions;
- relevant error-code mappings

should be read once by the main agent and supplied to subagents where useful.

Dispatch independent subagent work in parallel where possible.

Subagents should return compact endpoint documentation sections rather than extensive explanations.

The main agent remains responsible for:

- consolidating the results;
- preserving the required output format;
- detecting omissions;
- performing final validation.

## Error mapping rules

For every endpoint being processed:

1. Find the router declaration.
2. Record its `validateAuthorization` roles.
3. Identify the service method.
4. Identify the error mapper passed to `makeApiProblem`.
5. Inspect every mapper `.with(...)` arm.
6. Find the actual throw site for every mapped error.
7. Inspect all relevant helpers recursively.
8. Determine the concrete condition that triggers each error.
9. Resolve the wire error code from the source.
10. Reverse-check for errors thrown by the service but absent from the mapper.
11. Determine whether the error can actually be produced by a normal frontend interaction.
12. For reachable errors, provide executable UI reproduction steps.

Every mapper entry must appear as a row, including entries whose throw site is unreachable for that specific endpoint.

Dead mapper entries must be explicitly identified as such.

Do not assume that an unmapped error is necessarily HTTP 500. Apply the `defaultCommonErrorMapper` fallback rules.

The error name must be the `code:` value of the `ApiError`, not the error factory function name.

Wire codes must be copied from the source files and never reconstructed from memory.

## Frontend reachability

Frontend reachability must be determined from:

```text
route authLevels
→ AuthGuard
→ triggering action
→ form
→ BFF
→ process endpoint
```

Inspect the actual frontend code.

Consider:

- hidden controls;
- disabled actions;
- field normalization;
- forced values;
- frontend guards;
- BFF pre-checks;
- BFF-injected values;
- BFF validations that fail before the process call.

A normal UI interaction is the criterion.

Crafted requests, replays, and stale tabs are out of scope.

If an error cannot be reached through a normal UI interaction, explicitly state what prevents it.

Do not simply write "the UI prevents it".

## Reproduction steps

Every `CAN HAPPEN` error must contain executable UI reproduction steps.

The steps must include:

```text
Data precondition
1. ...
2. ...
3. ...
```

Use actual UI labels from the frontend locale files.

Do not derive UI labels from component or prop names.

If multiple errors share the same reproduction flow, document the shared flow once and reference it from the other rows, describing only the relevant difference.

If you are not entirely sure whether the error can actually happen through the UI, reconsider the `CAN HAPPEN` verdict rather than inventing reproduction steps, erring on the side of `CAN HAPPEN`.

## Output structure

Each documented endpoint must have the required endpoint section and error table.

The exact error-table format is:

```markdown
**## 1. `POST /eservices`**

Service: `createEService` → `innerCreateEService`. Mapper: `createEServiceErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`, `M2M_ADMIN_ROLE`.

| Error | Code | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) |
| ----- | ---- | ------ | --------------- | ---------------------- | ----------------------- |
| ...   | ...  | ...    | ...             | ...                    | ...                     |
```

Endpoints whose mapper is `emptyErrorMapper` have no non-500 mapper errors and should be handled according to the error-mapping workflow.

Add notes for errors thrown by the flow but absent from the mapper, after determining the status produced by the fallback rules.

---

# Stage 3 — Enrich with BFF endpoints

After the endpoint error documentation has been completed, enrich:

```text
packages/<process-name>-process/ENDPOINT-ERRORS.md
```

with the BFF endpoints that can reach each process endpoint.

The detailed tracing rules are defined by the `enrich-errors-with-bff-endpoints` workflow and must be followed in full.

## BFF source

Inspect:

```text
packages/backend-for-frontend/src/routers/
packages/backend-for-frontend/src/services/
```

Trace:

```text
BFF router
→ BFF service
→ process client
→ process operation
```

Follow helper functions recursively when necessary.

Do not assume that a service method directly calls the process client.

## OpenAPI operation IDs

Use:

```text
packages/api-clients/open-api/<process-name>Api.yml
```

to resolve the authoritative process operation ID.

Match process endpoints to BFF calls using the OpenAPI operation ID.

Do not match based only on:

- service names;
- comments;
- route paths;
- similar-looking function names.

A single BFF endpoint may call multiple process operations.

A single process operation may be reachable from multiple BFF endpoints.

Build the complete mapping:

```text
process operationId
→ all reachable BFF endpoints
```

## BFF documentation

For every endpoint in `ENDPOINT-ERRORS.md`, add:

```markdown
### BFF endpoints

- `POST /some/path`
```

immediately before its error table.

If no BFF endpoint reaches the process endpoint:

```markdown
### BFF endpoints

- `None`
```

If the section already exists:

- preserve existing entries;
- append newly discovered entries;
- do not duplicate entries;
- do not create another `### BFF endpoints` heading.

Use BFF router syntax, such as:

```text
/eservices/:eServiceId
```

not OpenAPI syntax:

```text
/eservices/{eServiceId}
```

## Minimal modification rule

During BFF enrichment, modify only the `### BFF endpoints` sections.

Do not alter:

- error tables;
- endpoint headings;
- `Service:` lines;
- error descriptions;
- wording;
- whitespace;
- line endings;
- unrelated Markdown.

Prefer minimal textual insertion.

---

# Resume and interruption handling

The workflow must be safely resumable.

If execution is interrupted during Stage 2:

1. Do not discard completed endpoint sections.
2. Re-read `ENDPOINTS.md`.
3. Re-read `ENDPOINT-ERRORS.md`.
4. Determine the remaining endpoints using method + path.
5. Continue from the first undocumented endpoint.

Do not assume that the previous run completed an entire batch merely because it was started.

Likewise, Stage 3 should inspect existing `### BFF endpoints` sections and avoid duplicating entries.

The agent must not claim completion while undocumented endpoints remain.

---

# Final validation

Before reporting success, verify:

### Endpoint list

- `ENDPOINTS.md` exists.
- Every current process router endpoint is represented.
- There are no unintended duplicate method/path combinations.
- Endpoint order is deterministic.

### Error documentation

- Every endpoint in `ENDPOINTS.md` has corresponding error documentation.
- Every mapper arm is represented.
- Dead mapper entries were checked against actual throw sites.
- Unmapped errors were checked against `defaultCommonErrorMapper`.
- Wire codes were read from source.
- FE reachability was not guessed.
- Every `CAN HAPPEN` row has executable reproduction steps.
- Every `Cannot happen` row explains the specific blocking condition.

### BFF enrichment

- Every documented process endpoint has exactly one `### BFF endpoints` section.
- BFF entries are complete and unique.
- Unreachable endpoints contain `None`.
- BFF paths use router syntax.
- Existing error documentation was not modified by the enrichment stage.

If any validation fails, do not report the workflow as complete. Fix the issue when possible; otherwise report the exact incomplete stage and reason.

# Final response

Keep the final response concise.

Report:

- process documented;
- number of process endpoints;
- number of endpoint/error sections created or updated;
- number of BFF endpoints discovered;
- number of process endpoints with at least one BFF endpoint;
- number of process endpoints with no BFF endpoint;
- whether the workflow completed successfully.

If the workflow stopped because the frontend repository was missing, report that explicitly as an error.

If the workflow was resumed from an existing `ENDPOINT-ERRORS.md`, mention that it resumed rather than regenerating already documented endpoint sections.
