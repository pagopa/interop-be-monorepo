---
name: agent-test
description: Generates the complete endpoint error map for one Interop backend process using error-messages-generator and the skill-test workflow.
argument-hint: The process name to document, for example "purpose".
tools: ["execute", "read", "edit", "search"]
---

# Interop Process Error Map

Generate the complete endpoint error documentation for the single process name supplied by the user.

## Input

The user must provide exactly one normalized process name without the `-process` suffix, for example:

```text
purpose
```

If no process name is provided, ask for it. Resolve the process package as:

```text
packages/[process-name]-process
```

## Workflow

### 1. Run the endpoint generator

From the repository root, execute:

```bash
cd packages/error-messages-generator && npx tsx src/readRouter.ts
```

Capture the complete JSON output from stdout. If the command fails, stop and report the command and relevant error;
do not continue with partial or inferred data.

### 2. Validate and select the process

Read `packages/error-messages-generator/output.schema.json` and use `output[process-name]` from the generator output.
If the process key is missing, stop and report that the requested process was not found.

Keep the generator endpoint order. The complete generator endpoint object is authoritative for method, path, service,
mapper, roles, and matching BFF endpoints.

### 3. Apply the skill-test workflow

For every endpoint in `output[process-name]`, in order, apply all instructions in:

```text
.agents/skills/skill-test/SKILL.md
```

Pass the complete endpoint object to the workflow. In particular, copy every
`endpoint.mapper.errors[]` entry directly into the Markdown table:

```text
{ code: number, message: string }
```

- `message` is the `Error` cell, for example `delegationNotFound`.
- `code` is the `Status` cell, for example `404`.
- Never replace these values with `TODO`, swap them, or infer them from the service implementation.

Copy every `endpoint.bffEndpoints[]` entry directly into the `### BFF endpoints` section, one `- METHOD path`
line per item, in array order. This list comes from the generator, not from grepping the BFF router or the
OpenAPI spec yourself. If the array is empty, write `- none found by the generator`.

For each endpoint, inspect the service flow for the trigger and inspect the frontend/BFF path for reachability and UI
reproduction steps. Endpoints using `emptyErrorMapper` are listed in the note required by the skill and do not
receive a table.

Write or update:

```text
packages/[process-name]-process/ENDPOINT-ERRORS.md
```

Preserve unrelated existing sections, avoid duplicate endpoint sections, and keep sections in generator order.

If the frontend repository is not available, do not guess the reachability verdict: report the missing repository and
follow the fallback documented in `skill-test/SKILL.md`.

### 4. Verify the result

Before returning, verify that:

- the output Markdown exists;
- every non-empty-mapper endpoint from `output[process-name]` has a section;
- every generator mapper error appears with its `message` and `code` values in the `Error` and `Status` columns;
- every `CAN HAPPEN` row has executable UI steps;
- every unreachable row has `—` in the reproduction column;
- BFF endpoint entries match `endpoint.bffEndpoints[]` verbatim (method + path), with no invented or omitted routes.

If any verification fails, fix the affected endpoint documentation and verify it again. Do not silently skip an
endpoint.

## Failure handling

If processing an endpoint fails, stop immediately and report:

1. the process name;
2. the endpoint method and path;
3. the failing step and error;
4. the output file state.

Do not continue with later endpoints after a failure.

## Final response

Report the process documented, the output file path, the number of endpoints processed, the number of endpoints
skipped because of `emptyErrorMapper`, and any remaining limitation such as an unavailable frontend repository.

## Never

- Do not use Python.
- Do not invent generator metadata, error names, statuses, BFF routes, or frontend reachability.
- Do not commit changes or create branches.