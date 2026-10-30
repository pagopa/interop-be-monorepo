# pagopa-interop-be-error-message-parser

Generates typed error message data from
`../backend-for-frontend/Messaggi-di-errore.csv`.

Run `pnpm --filter pagopa-interop-error-message-parser build` to generate
`src/generated/errorMessages.ts` and compile the package. Generation can also be
run separately with `pnpm --filter pagopa-interop-error-message-parser generate`.
From the repository root, use `pnpm generate-error-message` to generate only the
TypeScript source, without compiling the package.
The generated `src/generated/errorMessages.ts` is versioned to make data changes
reviewable. Regenerate it and include the updated file whenever the source CSV or
the shared error maps change. It is also restored by the Turbo build cache.
The source CSV must be versioned so clean checkouts and CI can build the package.

The generator locates the header row, including after spreadsheet metadata, and
selects `Process`, `Error`, `BFF endpoint`, `copy it` and `copy en` by name
(case-insensitive, ignoring surrounding whitespace). Column order does not
matter; all other columns are discarded.

The exported `errorMessages` array contains objects with `process`, `error`,
`errorCode`, `bffEndpoint` and `copy: { it, en }`. It uses
`as const satisfies readonly ErrorMessage[]` to preserve literal types;
`GeneratedErrorMessage` is the union of the generated entries.

Values, row order and duplicates are preserved. Empty or missing cells become
empty strings, and completely blank rows are omitted. No process, error code,
endpoint or translation validation is performed.

`errorCode` is derived from the shared error maps in commons, common errors and
service prefixes in models (for example `005-0014`). Process names are matched
ignoring case, spaces, hyphens and the `Process` suffix; `BFF` and
`Backend for frontend` identify the same service. Original CSV values are not
modified. Unknown processes or error names produce `errorCode: null` without
discarding the row. Error names are matched exactly, and common error names take
precedence over process-specific names.

Generation fails for unreadable files, malformed CSV or missing required headers.
