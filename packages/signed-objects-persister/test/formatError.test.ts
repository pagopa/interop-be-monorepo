import { describe, it, expect } from "vitest";
import { formatError } from "../src/utils/errorFormatter.js";

describe("formatError", () => {
  it("should format an Error without stack", () => {
    // create a custom error class with no stack
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
    // do not modify error.stack — use as-is

    const result = formatError(error);

    expect(result).toMatchSnapshot();
  });

  it("should serialize a plain object", () => {
    const obj = { foo: "bar" }; // immutable
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
