import { Ajv } from "ajv";
import { readFileSync } from "node:fs";

export type ValidationResult =
  | { valid: true }
  | { valid: false; errors: string[] };

export function validateJsonFile(
  jsonPath: string,
  schemaPath: string
): ValidationResult {
  const data: unknown = JSON.parse(readFileSync(jsonPath, "utf8"));
  const schema: object = JSON.parse(readFileSync(schemaPath, "utf8"));

  const ajv = new Ajv({ allErrors: true });
  const validateFn = ajv.compile(schema);

  if (validateFn(data)) {
    return { valid: true };
  }

  return {
    valid: false,
    errors: (validateFn.errors ?? []).map(
      (e) => `${e.instancePath || "/"} ${e.message ?? "is invalid"}`
    ),
  };
}
