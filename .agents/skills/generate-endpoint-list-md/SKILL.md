---

name: generate-endpoint-list-md
description: Generate an ENDPOINTS.md file listing all HTTP endpoints exposed by a process package in interop-be-monorepo. Use when asked to document the endpoints of a specific process package.
argument-hint: "[process-folder]"
---------------------------------

# Generate ENDPOINTS.md

Generate an `ENDPOINTS.md` file containing the HTTP endpoints exposed by a process package in `interop-be-monorepo`.

## Input

The user will provide the name of a process folder, for example:

* `catalog-process`
* `agreement-process`
* `tenant-process`

If the user does not provide a process folder name, ask for it.

## Repository structure

The repository is located at:

```text
interop-be-monorepo/
└── packages/
    ├── ...
    ├── catalog-process/
    │   └── src/
    │       └── routers/
    │           ├── catalogRouter.ts
    │           └── anotherRouter.ts
    └── ...
```

Most API packages are suffixed with `-process`.

The endpoints are normally defined inside:

```text
interop-be-monorepo/packages/<process-folder>/src/routers/
```

There may be multiple files inside the `routers` directory. Inspect **all files** in that directory, not just one.

## Procedure

1. Locate the requested process folder under:

   `interop-be-monorepo/packages/`

2. Locate its:

   `src/routers/`

   directory.

3. Inspect **every relevant source file** inside `src/routers/`.

4. Identify every HTTP route registration.

   Routes may use methods such as:

   * `.get(...)`
   * `.post(...)`
   * `.put(...)`
   * `.patch(...)`
   * `.delete(...)`
   * `.head(...)`
   * `.options(...)`

5. Extract:

   * the HTTP method
   * the route path

6. Do not include handler implementation details, authorization, service calls, status codes, schemas, or error handling.

7. Preserve the route path exactly as defined in the router, including:

   * path parameters such as `:eServiceId`
   * nested paths
   * trailing path segments

8. If the router uses a variable or router prefix outside the individual route declaration, inspect the surrounding code and include the effective endpoint path when it can be determined reliably.

9. Include endpoints from all router files in a single list.

10. Number the endpoints sequentially starting from `1`.

11. Create or overwrite:

    ```text
    interop-be-monorepo/packages/<process-folder>/ENDPOINTS.md
    ```

## Output format

The first line must be:

```markdown
# <process-folder>
```

Then list every endpoint using this exact structure:

```markdown
## 1. `POST /some/path`

TODO

## 2. `GET /another/path`

TODO
```

There must be exactly one `TODO` immediately underneath each endpoint heading.

Do not add descriptions, explanations, tables, source-file names, or other content.

## Example

Given:

```typescript
router
  .post(
    "/eservices/:eServiceId/descriptors/:descriptorId/approve",
    async (req, res) => {
      // ...
    }
  )
  .get(
    "/eservices/:eServiceId",
    async (req, res) => {
      // ...
    }
  );
```

The generated `ENDPOINTS.md` must contain:

```markdown
# catalog-process

## 1. `POST /eservices/:eServiceId/descriptors/:descriptorId/approve`

TODO

## 2. `GET /eservices/:eServiceId`

TODO
```

## Important rules

* **Inspect all files** under `src/routers`; never assume there is only one router file.
* Do not invent endpoints based on service methods, OpenAPI files, tests, or other sources when the endpoint cannot be found in the routers.
* Do not modify the router source files.
* Do not modify any existing content outside `ENDPOINTS.md`.
* If `ENDPOINTS.md` already exists, overwrite it with the newly generated complete list.
* If no routes can be found, report that no endpoints were found instead of creating a misleading document.
* Avoid duplicate endpoints. If the same HTTP method and path appear multiple times, include them only once unless the implementations clearly represent distinct routes.
* Keep the endpoint order deterministic. Prefer the order in which routes appear while traversing the router files; when multiple files are involved, process files in lexicographical filename order.
