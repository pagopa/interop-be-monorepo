# error-messages

Generates typed error message data from
`error-messages.csv` in this package, and validates the generated data.

Run `pnpm --filter error-messages build` to generate
`src/generated/errorMessages.ts` and compile the
package. Generation can also be run separately with
`pnpm --filter error-messages generate`.
From the repository root, use `pnpm generate-error-messages` to generate only the
TypeScript source, without compiling the package.
The generated
`src/generated/errorMessages.ts` is versioned to make
data changes reviewable. Regenerate it and include the updated file whenever
the source CSV or the shared error maps change. It is also restored by the Turbo
build cache.
The source CSV must be versioned so clean checkouts and CI can build the package.

`src/index.ts` re-exports `errorMessages` and the `GeneratedErrorMessage` type
from the generated module. The package is compiled to `dist`, and `package.json`
sets `main` to `dist` and `exports` to `./dist/index.js`. The BFF imports it by
package name (`pagopa-interop-error-messages`), so it consumes the compiled
output; run `pnpm --filter error-messages build` before using the package
outside of a full build. Generation and validation helpers are not re-exported.

Run `pnpm validate-error-messages` from the repository root, or
`pnpm --filter error-messages validate`, to validate the generated data against
the CSV, error codes, BFF router endpoints and translation dictionaries.
Validation also runs as part of linting. The CLI accepts optional `--csv` and
`--generated` paths relative to the repository root.

The generator locates the header row, including after spreadsheet metadata, and
selects `Process`, `Error`, `BFF endpoint`, `copy it` and `copy en` by name
(case-insensitive, ignoring surrounding whitespace). Column order does not
matter; all other columns are discarded.

The generated `errorMessages` array contains objects with `process`, `error`,
`errorCode`, `bffEndpoint` and `copy: { it, en }`. It uses
`as const satisfies readonly ErrorMessage[]` from `pagopa-interop-models` to
preserve literal types;
`GeneratedErrorMessage` is the union of the generated entries.

For rows with a resolved error code, values, row order and duplicates are preserved.
Empty or missing cells become
empty strings, and completely blank rows are omitted. Generation does not
validate processes, error codes, endpoints or translations; run validation
separately as described above.

`errorCode` is derived from the shared error maps in commons, common errors and
service prefixes in models (for example `005-0014`). Process names are matched
ignoring case, spaces, hyphens and the `Process` suffix; `BFF` and
`Backend for frontend` identify the same service. Original CSV values are not
modified. Rows with unknown processes or error names resolve to `errorCode: null`
and are excluded from the generated TypeScript. Error names are matched exactly, and common error names take
precedence over process-specific names.

Generation fails for unreadable files, malformed CSV or missing required headers.
