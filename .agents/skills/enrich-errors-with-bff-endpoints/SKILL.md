---
name: enrich-errors-with-bff-endpoints
description: Enrich an ENDPOINT-ERRORS.md file with all Backend-for-Frontend endpoints that can reach each endpoint of a specific process in interop-be-monorepo. Use when asked to add or update BFF endpoint information in a process's endpoint error documentation.
argument-hint: "[process-name]"
---

# enrich-errors-with-bff-endpoints

## Purpose

Enrich the endpoint error documentation of a specific process with the corresponding Backend-for-Frontend (BFF) endpoints that can reach each process endpoint.

The skill operates inside a workspace containing an `interop-be-monorepo` directory.

The user provides the **process name** as input, for example `catalog`.

The skill must modify **only** the `ENDPOINT-ERRORS.md` file of that process, and only by inserting `### BFF endpoints` sections as described below.

---

## Input

The skill accepts one required input:

- `process`: the process name, for example `catalog`, `agreement`, `attribute`, etc.

Given `process = catalog`, the relevant locations are:

```text
interop-be-monorepo/
├── packages/
│   ├── backend-for-frontend/
│   ├── catalog-process/
│   │   └── ENDPOINT-ERRORS.md
│   └── api-clients/
│       └── open-api/
│           └── catalogApi.yml
```

The process directory is:

```text
packages/{process}-process/
```

The OpenAPI specification is:

```text
packages/api-clients/open-api/{process}Api.yml
```

The BFF package is:

```text
packages/backend-for-frontend/
```

---

## Objective

For every endpoint documented in:

```text
packages/{process}-process/ENDPOINT-ERRORS.md
```

determine which endpoints exposed by `backend-for-frontend` eventually call that process endpoint.

The relationship must be determined by following the actual TypeScript code.

The OpenAPI `operationId` is the authoritative identifier for a process endpoint.

For example, if the OpenAPI specification contains:

```yaml
/eservices/{eServiceId}/submitDelegatedArchiving:
  post:
    operationId: submitDelegatedEServiceArchiving
```

and the BFF contains:

```ts
await catalogProcessClient.submitDelegatedEServiceArchiving(...)
```

then that BFF call reaches the process endpoint represented by that `operationId`.

---

## Process

### 1. Locate the endpoint errors file

Read:

```text
packages/{process}-process/ENDPOINT-ERRORS.md
```

Do not modify it yet.

The file contains sections corresponding to process endpoints, for example:

```md
## 1. `POST /eservices`

Service: `createEService` → `innerCreateEService`. Mapper: `createEServiceErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`, `M2M_ADMIN_ROLE`.

| Error | Code | Status | When it happens | ... |
| ----- | ---- | ------ | --------------- | --- |
```

Do **not** rely on the `Service:` line to determine the relationship between the endpoint and the BFF.

The endpoint itself and the OpenAPI specification must be used as the authoritative sources.

---

### 2. Read the process OpenAPI specification

Read:

```text
packages/api-clients/open-api/{process}Api.yml
```

Extract every endpoint and its `operationId`.

The HTTP method, path, and `operationId` form the mapping:

```text
HTTP method + process path + operationId
```

For example:

```yaml
/eservices/{eServiceId}/descriptors/{descriptorId}/scheduleArchive:
  post:
    operationId: scheduleEServiceDescriptorArchiving
```

creates the mapping:

```text
POST /eservices/{eServiceId}/descriptors/{descriptorId}/scheduleArchive
    -> scheduleEServiceDescriptorArchiving
```

The `operationId` is used internally by the skill to trace calls. It does not need to be written into the Markdown output.

Do not assume that the order of endpoints in the OpenAPI specification matches the order in `ENDPOINT-ERRORS.md`.

---

### 3. Inspect the BFF routers

Inspect:

```text
packages/backend-for-frontend/src/routers/
```

The routers expose the public BFF endpoints.

Look for route definitions such as:

```ts
.post(
  "/eservices/:eServiceId/submitDelegatedArchiving",
  async (req, res) => {
    ...
  }
)
```

Record the HTTP method and route path exactly as defined by the BFF router.

For example:

```text
POST /eservices/:eServiceId/submitDelegatedArchiving
```

is a BFF endpoint.

Do not confuse a BFF endpoint with an internal process endpoint.

---

### 4. Follow the BFF service calls

Inspect:

```text
packages/backend-for-frontend/src/services/
```

Determine which service function is invoked by each router.

Then trace that service function to determine which process client operations it eventually invokes.

For example:

```ts
submitDelegatedEServiceArchiving: async (
  eServiceId,
  seed,
  { logger, headers },
) => {
  await catalogProcessClient.submitDelegatedEServiceArchiving(seed, {
    headers,
    params: {
      eServiceId,
    },
  });
};
```

This establishes:

```text
BFF endpoint
    -> BFF service function
    -> catalogProcessClient.submitDelegatedEServiceArchiving
    -> process operationId: submitDelegatedEServiceArchiving
```

The skill must perform this analysis for all relevant BFF endpoints.

---

### 5. Recursively follow helper functions

A process operation may not be called directly from the service function.

For example:

```ts
async function archiveEservice() {
  await catalogProcessClient.submitDelegatedEServiceArchiving();
}

async function serviceCall() {
  await catalogProcessClient.otherOperationId();
  await archiveEservice();
}
```

The skill must recognize that `serviceCall` eventually calls:

```text
submitDelegatedEServiceArchiving
```

Therefore, any BFF router that invokes `serviceCall` must be associated with the corresponding process endpoint.

Follow helper functions recursively when necessary.

Helpers may:

- be in the same file;
- be in another service file;
- call other helper functions;
- eventually invoke a process client.

Do not stop tracing merely because the process-client call is not directly visible inside the service function called by the router.

Avoid infinite recursion by tracking functions/files already visited.

---

### 6. Identify process-client calls

The relevant calls will generally look like:

```ts
catalogProcessClient.someOperationId(...)
```

but do not assume that every process client is named exactly `{process}ProcessClient`.

Inspect the BFF code to determine which client corresponds to the requested process.

A BFF service may call:

- one endpoint of the requested process;
- multiple endpoints of the requested process;
- endpoints from multiple processes.

Only calls belonging to the requested process should be considered.

For example:

```ts
await catalogProcessClient.operationA();
await agreementProcessClient.operationB();
await catalogProcessClient.operationC();
```

When processing `catalog`, only `operationA` and `operationC` matter.

---

### 7. Build the BFF endpoint → process operation mapping

For every BFF endpoint, determine the set of process `operationId`s it can eventually invoke.

For example:

```text
POST /foo
    -> serviceA()
       -> catalogProcessClient.operationA()

POST /bar
    -> serviceB()
       -> helper()
          -> catalogProcessClient.operationB()
          -> catalogProcessClient.operationC()
```

produces:

```text
operationA -> POST /foo

operationB -> POST /bar
operationC -> POST /bar
```

If multiple BFF endpoints reach the same process operation, associate all of them with that operation.

For example:

```text
operationA
    -> POST /foo
    -> GET /bar
    -> PUT /baz
```

---

## Matching process endpoints

Use the `operationId` from the OpenAPI specification as the primary matching key.

Do not attempt to infer the match from:

- service function names;
- router file names;
- comments;
- the `Service:` line in `ENDPOINT-ERRORS.md`;
- similar-looking paths.

The relationship is:

```text
ENDPOINT-ERRORS.md endpoint
        ↓
OpenAPI endpoint
        ↓
operationId
        ↓
BFF process-client call
        ↓
BFF router endpoint
```

The skill must use code tracing to establish the final BFF endpoint association.

---

## Editing `ENDPOINT-ERRORS.md`

This is the most important constraint.

The skill may make **only one type of modification**:

Insert a `### BFF endpoints` section for each endpoint, immediately before that endpoint's error table.

For example, given:

```md
## 1. `POST /eservices`

Service: `createEService` → `innerCreateEService`. Mapper: `createEServiceErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`, `M2M_ADMIN_ROLE`.

| Error | Code | Status | When it happens |
| ----- | ---- | ------ | --------------- |
```

if the endpoint is reachable through two BFF endpoints, transform it into:

```md
## 1. `POST /eservices`

Service: `createEService` → `innerCreateEService`. Mapper: `createEServiceErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- `POST /eservices`
- `POST /some-other-route`

| Error | Code | Status | When it happens |
| ----- | ---- | ------ | --------------- |
```

If no BFF endpoint calls the process endpoint, insert:

```md
### BFF endpoints

- `None`
```

---

## Existing `### BFF endpoints` sections

The skill must be safe to run multiple times.

If an endpoint already has a `### BFF endpoints` section, **append the newly discovered BFF endpoints to that existing list** rather than creating another `### BFF endpoints` heading.

Do not remove existing entries.

Do not duplicate an endpoint that is already present.

For example:

```md
### BFF endpoints

- `POST /foo`
- `POST /bar`
```

must remain unchanged if the analysis discovers the same endpoints again.

If a new endpoint is discovered:

```md
### BFF endpoints

- `POST /foo`
- `POST /bar`
- `GET /baz`
```

---

## Preservation requirements

The Markdown file must otherwise remain **exactly unchanged**.

The skill must NOT:

- modify endpoint headings;
- modify endpoint paths;
- modify HTTP methods;
- modify the error tables;
- modify table formatting;
- modify error descriptions;
- modify the `Service:` lines;
- modify wording;
- fix spelling;
- reformat Markdown;
- normalize whitespace;
- normalize line endings;
- reorder anything;
- add unrelated information;
- remove existing content;
- change blank lines except where strictly necessary to insert the new section.

Do not rewrite the Markdown document using a Markdown parser or formatter if doing so could alter unrelated formatting.

Prefer a minimal textual insertion into the existing file.

The only permitted new content is:

```md
### BFF endpoints

- `METHOD /path`
- `METHOD /path`
```

or:

```md
### BFF endpoints

- `None`
```

---

## Path syntax

BFF paths must use the syntax exactly as defined by the BFF router.

For example:

```ts
.post(
  "/eservices/:eServiceId/submitDelegatedArchiving",
  ...
)
```

must produce:

```md
- `POST /eservices/:eServiceId/submitDelegatedArchiving`
```

Do not convert BFF parameters from:

```text
:eServiceId
```

to:

```text
{eServiceId}
```

The process OpenAPI path and the BFF path are different representations and must remain distinct.

---

## Multiple process calls

A single BFF endpoint may call multiple operations of the requested process.

For example:

```ts
async function serviceCall() {
  await catalogProcessClient.operationA();
  await catalogProcessClient.operationB();
}
```

That same BFF endpoint must appear under both process endpoints:

```md
## 1. `POST /foo`

### BFF endpoints

- `POST /bff/service`

| Error | ...
```

and:

```md
## 2. `POST /bar`

### BFF endpoints

- `POST /bff/service`

| Error | ...
```

---

## Multiple BFF endpoints

If several BFF endpoints eventually invoke the same process operation, list all of them.

Each endpoint must appear only once within a given `### BFF endpoints` section.

---

## Unreachable endpoints

Every process endpoint documented in `ENDPOINT-ERRORS.md` must receive a `### BFF endpoints` section.

If no BFF endpoint can be found that eventually invokes the corresponding operation, use:

```md
### BFF endpoints

- `None`
```

Do not omit the section.

---

## Validation before editing

Before modifying the file:

1. Verify that the requested process directory exists.
2. Verify that `ENDPOINT-ERRORS.md` exists.
3. Verify that `packages/api-clients/open-api/{process}Api.yml` exists.
4. Extract all process endpoints and their `operationId`s from the OpenAPI specification.
5. Identify the BFF router endpoints.
6. Trace their service calls and helper functions.
7. Build the complete mapping between process `operationId`s and BFF endpoints.
8. Verify that every endpoint in `ENDPOINT-ERRORS.md` can be associated with an OpenAPI operation.
9. Only then modify `ENDPOINT-ERRORS.md`.

If an endpoint cannot be reliably matched to an OpenAPI operation, do not guess. Report the mismatch and do not make a potentially incorrect modification.

---

## Final verification

After editing, verify that:

- every endpoint in `ENDPOINT-ERRORS.md` has exactly one `### BFF endpoints` section;
- each section contains every discovered BFF endpoint exactly once;
- unreachable process endpoints contain only `- `None``;
- existing BFF endpoint entries were preserved;
- no error table was modified;
- no endpoint heading was modified;
- no unrelated Markdown content was modified.

The skill should report a concise summary of what was enriched, including:

- process name;
- number of process endpoints analyzed;
- number of BFF endpoints discovered;
- number of process endpoints with at least one BFF endpoint;
- number of process endpoints with no BFF endpoint.

Do not include the full contents of the Markdown file in the response unless explicitly requested.
