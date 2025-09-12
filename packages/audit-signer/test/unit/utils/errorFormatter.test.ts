import { describe, it, expect } from "vitest";
import { formatError } from "../../../src/utils/errorFormatter.js";

describe("formatError", () => {
  it("should format an Error without stack", () => {
    class NoStackError extends Error {
      constructor(message: string) {
        super(message);
        Object.defineProperty(this, "stack", { value: undefined });
      }
    }

    const error = new NoStackError("Test error");
    const result = formatError(error);

    expect(result).toBe("Error: Test error");
  });

  it("should format an Error with stack", () => {
    const error = new Error("Stacked error");
    const result = formatError(error);

    expect(result).toContain("Error: Stacked error");
    expect(result).toContain("Stack trace:");
  });

  it("should serialize a plain object", () => {
    const obj = { foo: "bar" };
    const result = formatError(obj);

    expect(result).toBe(JSON.stringify(obj));
  });

  it("should convert primitive values to string", () => {
    expect(formatError("simple error")).toBe(JSON.stringify("simple error"));
    expect(formatError(123)).toBe("123");
    expect(formatError(null)).toBe("null");
  });

  it("should handle non-serializable object gracefully", () => {
    const nonSerializable = Object.freeze({
      get self() {
        throw new Error("Cannot serialize");
      },
    });

    const result = formatError(nonSerializable);

    expect(result).toBe("[object Object]");
  });
});
