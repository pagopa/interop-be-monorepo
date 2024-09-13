import { describe, expect, it } from "vitest";
import { inactiveAgreement, inactiveEService } from "../src/errors";
import { failedValidation, successfulValidation } from "../src/utils";

describe("failedValidation", () => {
  it("array of errors", () => {
    const errors = [inactiveEService(), inactiveAgreement()];
    const result = failedValidation(errors);
    expect(result).toEqual({
      data: undefined,
      errors: [inactiveEService(), inactiveAgreement()],
    });
  });
  it("array of one error", () => {
    const errors = [inactiveEService()];
    const result = failedValidation(errors);
    expect(result).toEqual({
      data: undefined,
      errors: [inactiveEService()],
    });
  });
  it("array of errors or undefined", () => {
    const errors = [inactiveEService(), inactiveAgreement(), undefined];
    const result = failedValidation(errors);
    expect(result).toEqual({
      data: undefined,
      errors: [inactiveEService(), inactiveAgreement()],
    });
  });
  it("nested array of errors", () => {
    const errors = [[inactiveEService(), inactiveAgreement()], undefined];
    const result = failedValidation(errors);
    expect(result).toEqual({
      data: undefined,
      errors: [inactiveEService(), inactiveAgreement()],
    });
  });
  it("nested array of errors or undefined", () => {
    const errors = [
      [inactiveEService(), inactiveAgreement(), undefined],
      undefined,
    ];
    const result = failedValidation(errors);
    expect(result).toEqual({
      data: undefined,
      errors: [inactiveEService(), inactiveAgreement()],
    });
  });
});

describe("successfulValidation", () => {
  it("string", () => {
    const resultString = "result";
    const result = successfulValidation(resultString);
    expect(result).toEqual({ data: resultString, errors: undefined });
  });
  it("number", () => {
    const resultNumber = 1;
    const result = successfulValidation(resultNumber);
    expect(result).toEqual({ data: resultNumber, errors: undefined });
  });
});
