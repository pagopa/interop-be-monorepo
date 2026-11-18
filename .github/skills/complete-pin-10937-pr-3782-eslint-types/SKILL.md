---
name: complete-pin-10937-pr-3782-eslint-types
description: Complete PIN-10937 / PR 3782 ESLint object-literal type annotations. Use when asked to continue or finish PR 3782, or to migrate packages alphabetically to satisfy interop/require-type-for-object with concrete types.
---

# Complete PR 3782 ESLint type annotations

## Goal

Make every package changed by PR 3782 pass:

1. `interop/require-type-for-object`
2. Package lint
3. Package type-check/build when the package provides those scripts

## Work order

1. Read the current branch and PR 3782 with `gh pr view 3782`.
2. Find package directories under `packages/` and sort them alphabetically.
3. Process packages one at a time.
4. Stop at the first package that fails lint.
5. Fix that package completely before moving to the next package.
6. After verification, update the PR description in English.

Do not jump between packages while one package still has lint violations.

## Type selection

Prefer types already defined by the project:

- Domain types are examples, not an exhaustive list: `EService`, `Descriptor`, `Document`, `Purpose`, `Tenant`, `Agreement`, `Delegation`, `EServiceTemplate`, `EServiceTemplateVersion`, `RiskAnalysis`, `Attribute`, `Key`, `ProducerKeychain`.
- For any other domain object, inspect and use the exported types in `pagopa-interop-models`; do not limit the search to the examples above.
- API types: generated seed, payload, response, and request types, for example types under `pagopa-interop-api-clients`.
- Existing local types: types exported by the function, service, or module being exercised.
- Generic containers: `ListResult<T>`, `WithMetadata<T>`, or an explicit local structure only when no domain/API type exists.

Before using `ReturnType<typeof functionName>`, find the function's explicit return type and use that type directly. This applies especially to mock builders and converter functions. Do not use `ReturnType<typeof getMockPurpose>`, `ReturnType<typeof getMockEService>`, or similar when `Purpose`, `EService`, or another domain type is exported.

Use `typeof existingTypedVariable` only when it is the smallest correct type for an inferred local derivative, not as a replacement for an available domain type.

If no domain/API/local type is sufficiently certain, preserve the lint green state with:

```ts
// TODO REVIEW THIS CHANGE
// eslint-disable-next-line interop/require-type-for-object
const uncertainObject = {
  // ...
};
```

Use this pair only for genuinely uncertain object literals. Keep the disable scoped to the next line; do not add broad file/package disables.

## Object annotations

For every variable initialized with an object literal, add a concrete type annotation:

```ts
const eservice: EService = {
  ...getMockEService(),
  producerId,
};
```

For a list, use the result type:

```ts
const result: ListResult<EService> = {
  results,
  totalCount: results.length,
};
```

For API seed/payload objects, use the generated API type instead of declaring the fields manually.

Do not use:

- Broad ESLint disables added around a package or file
- `as any`
- `as unknown as` when a real domain/API type is available

## Safe implementation

- Make surgical changes only in files reported by lint.
- Use one pass per file or one coherent group of related files.
- Preserve existing test behavior and fixtures.
- Add or correct imports for every used model/API type.
- Fix `perfectionist/sort-imports` and Prettier errors after changing imports or types.
- Never remove unrelated object properties to make a type compile.
- If a property belongs to a descriptor, document, or version rather than to a template/service, keep it on the correct domain object.

## Verification

After each package:

1. Run `pnpm --dir packages/<package> lint`.
2. If `check` exists, run `pnpm --dir packages/<package> check`.
3. If `build` exists, run `pnpm --dir packages/<package> build`.
4. Run focused tests with `pnpm --dir packages/<package> test` or the package's specific test script when container infrastructure is not required.
5. Do not record a package as resolved until lint is zero and type-check/build are verified.

## PR description

Update PR 3782 with `gh pr edit 3782 --body ...`.

Keep the description in English.

Use two sections:

- `## Resolved packages`
- `## In progress`

Move a package to `Resolved packages` only after it passes lint and available static/build checks.
