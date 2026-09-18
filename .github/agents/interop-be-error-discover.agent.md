---
name: interop-be-error-discover
description: Generates endpoint error documentation for a single Interop backend process.
argument-hint: The process name to document, e.g. "catalog".
tools: ["execute", "read", "edit", "search"]
---

---

# Interop Backend Error Discovery

Generate `ENDPOINT-ERRORS.md` for the backend process specified by the user.

## Input

The user must provide exactly one process name.

For example:

```text
catalog
```

The corresponding package is:

```text
packages/[process-name]-process
```

If no process name is provided, ask the user for one.

## Step 1 — Run the endpoint generator

From the repository root (`interop-be-monorepo`), execute:

```bash
cd packages/error-messages-generator && npx tsx src/readRouter.ts
```

Capture the complete JSON output from stdout.

If the command exits with a non-zero exit code:

1. Stop.
2. Report the command failure.
3. Include the relevant error output.

Do not continue using partial or inferred data.

## Step 2 — Read the output schema

Read:

```text
packages/error-messages-generator/output.schema.json
```

Use this schema to interpret the generator output.

The endpoints for the requested process are:

```text
output[process-name]
```

If the requested process does not exist in the generator output, stop and report the problem.

## Step 3 — Process each endpoint

Iterate over every endpoint in:

```text
output[process-name]
```

in the order in which they appear.

For each endpoint, invoke the `interop-be-mapping-errors` skill.

Pass the skill:

1. The process name.
2. The complete endpoint object from the generator output.

The skill is responsible for analysing that endpoint and adding its documentation to:

```text
packages/[process-name]-process/ENDPOINT-ERRORS.md
```

Do not independently perform the endpoint-error analysis in this agent. Delegate it to the skill.

### Important

The endpoint object supplied to the skill already contains:

- HTTP method
- path
- router file
- OpenAPI metadata
- service metadata
- mapper metadata
- mapped errors
- roles
- matching BFF endpoints

Do not rediscover this information before invoking the skill.

## Step 4 — Continue through all endpoints

Invoke the skill once for every endpoint in `output[process-name]`.

Do not skip endpoints unless the skill explicitly reports that an endpoint should not have a section, such as an endpoint using `emptyErrorMapper`.

If a skill invocation fails:

1. Stop processing.
2. Report which endpoint failed.
3. Report the error returned by the skill.
4. Do not silently continue with the remaining endpoints.

## Step 5 — Final verification

After all endpoint skill invocations have completed, verify that:

```text
packages/[process-name]-process/ENDPOINT-ERRORS.md
```

exists.

Report the generated file and the process that was documented.

## Never

- Do not use python
