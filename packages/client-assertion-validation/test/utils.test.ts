import { describe, expect, it } from "vitest";
import { inactiveAgreement, inactiveEService } from "../src/errors.js";
import { failedValidation, successfulValidation } from "../src/utils.js";

describe("failedValidation", () => {
  it("array of errors", () => {
    const errors = [inactiveEService(), inactiveAgreement()];
    const result = failedValidation(errors);
    expect(result).toEqual({
      hasSucceeded: false,
      errors: [inactiveEService(), inactiveAgreement()],
    });
  });
  it("array of one error", () => {
    const errors = [inactiveEService()];
    const result = failedValidation(errors);
    expect(result).toEqual({
      hasSucceeded: false,
      errors: [inactiveEService()],
    });
  });
});

describe("successfulValidation", () => {
  it("string", () => {
    const resultString = "result";
    const result = successfulValidation(resultString);
    expect(result).toEqual({ data: resultString, hasSucceeded: true });
  });
  it("number", () => {
    const resultNumber = 1;
    const result = successfulValidation(resultNumber);
    expect(result).toEqual({ data: resultNumber, hasSucceeded: true });
  });
});
