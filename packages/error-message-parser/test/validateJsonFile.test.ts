import { join } from "node:path";
import { describe, afterEach, it, expect } from "vitest";

import { validateJsonFile } from "../src/index.js";
import { createTestJsonFile, deleteCsvFiles } from "./utils.js";

describe("validateJsonFile", () => {
  afterEach(() => {
    deleteCsvFiles();
  });

  const schema = {
    type: "object",
    properties: {
      key: { type: "string" },
      count: { type: "number" },
    },
    required: ["key", "count"],
    additionalProperties: false,
  };

  it("should return valid when the JSON matches the schema", () => {
    const schemaPath = createTestJsonFile(schema);
    const jsonPath = createTestJsonFile({ key: "005-0014", count: 1 });

    expect(validateJsonFile(jsonPath, schemaPath)).toEqual({ valid: true });
  });

  it("should report a missing required property", () => {
    const schemaPath = createTestJsonFile(schema);
    const jsonPath = createTestJsonFile({ key: "005-0014" });

    const result = validateJsonFile(jsonPath, schemaPath);
    expect(result).toEqual({
      valid: false,
      errors: ["/ must have required property 'count'"],
    });
  });

  it("should report the instance path of a wrongly typed property", () => {
    const schemaPath = createTestJsonFile(schema);
    const jsonPath = createTestJsonFile({ key: "005-0014", count: "one" });

    expect(validateJsonFile(jsonPath, schemaPath)).toEqual({
      valid: false,
      errors: ["/count must be number"],
    });
  });

  it("should report all errors, not only the first one", () => {
    const schemaPath = createTestJsonFile(schema);
    const jsonPath = createTestJsonFile({ key: 1, count: "one", extra: true });

    const result = validateJsonFile(jsonPath, schemaPath);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors).toHaveLength(3);
    }
  });

  it("should throw when the JSON file does not exist", () => {
    const schemaPath = createTestJsonFile(schema);
    expect(() => validateJsonFile("missing.json", schemaPath)).toThrow();
  });

  it("should throw when the schema is not a valid schema", () => {
    const schemaPath = createTestJsonFile({ type: "not-a-type" });
    const jsonPath = createTestJsonFile({});
    expect(() => validateJsonFile(jsonPath, schemaPath)).toThrow();
  });

  describe("against schemas/error.messages.schema.json", () => {
    const errorMessagesSchemaPath = join(
      __dirname,
      "../../../schemas/error.messages.schema.json"
    );

    it("should accept a well-formed error messages file", () => {
      const jsonPath = createTestJsonFile({
        "GET /tenant/:tenantId": {
          "005-0014": {
            key: "005-0014",
            messages: { it: "Un messaggio di errore", en: "Some error" },
          },
        },
      });

      expect(validateJsonFile(jsonPath, errorMessagesSchemaPath)).toEqual({
        valid: true,
      });
    });

    it("should reject an invalid endpoint key and an invalid error code", () => {
      const jsonPath = createTestJsonFile({
        "FETCH /tenant": {},
        "GET /tenant/:tenantId": {
          "5-14": { key: "005-0014", messages: { it: "Errore" } },
        },
      });

      const result = validateJsonFile(jsonPath, errorMessagesSchemaPath);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors).toContainEqual(
          expect.stringContaining("(GET|POST|PUT|DELETE|PATCH)")
        );
        expect(result.errors).toContainEqual(
          expect.stringContaining("\\d{3}-\\d{3,5}")
        );
      }
    });

    it("should reject messages without the italian translation", () => {
      const jsonPath = createTestJsonFile({
        "GET /tenant/:tenantId": {
          "005-0014": { key: "005-0014", messages: { en: "Some error" } },
        },
      });

      const result = validateJsonFile(jsonPath, errorMessagesSchemaPath);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors).toContainEqual(
          expect.stringContaining("must have required property 'it'")
        );
      }
    });
  });
});
