import { describe, expect, it } from "vitest";
import { itemState } from "pagopa-interop-models";
import { invalidAgreementState, invalidEServiceState } from "../src/errors.js";
import { failedValidation, successfulValidation } from "../src/utils.js";

describe("failedValidation", () => {
  it("array of errors", () => {
    const errors = [
      invalidEServiceState(itemState.inactive),
      invalidAgreementState(undefined),
    ];
    const result = failedValidation(errors);
    expect(result).toEqual({
      data: undefined,
      errors: [
        invalidEServiceState(itemState.inactive),
        invalidAgreementState(undefined),
      ],
    });
  });
  it("array of one error", () => {
    const errors = [invalidEServiceState(itemState.inactive)];
    const result = failedValidation(errors);
    expect(result).toEqual({
      data: undefined,
      errors: [invalidEServiceState(itemState.inactive)],
    });
  });
  it("array of errors or undefined", () => {
    const errors = [
      invalidEServiceState(itemState.inactive),
      invalidAgreementState(undefined),
      undefined,
    ];
    const result = failedValidation(errors);
    expect(result).toEqual({
      data: undefined,
      errors: [
        invalidEServiceState(itemState.inactive),
        invalidAgreementState(undefined),
      ],
    });
  });
  it("nested array of errors", () => {
    const errors = [
      [
        invalidEServiceState(itemState.inactive),
        invalidAgreementState(undefined),
      ],
      undefined,
    ];
    const result = failedValidation(errors);
    expect(result).toEqual({
      data: undefined,
      errors: [
        invalidEServiceState(itemState.inactive),
        invalidAgreementState(undefined),
      ],
    });
  });
  it("nested array of errors or undefined", () => {
    const errors = [
      [
        invalidEServiceState(itemState.inactive),
        invalidAgreementState(undefined),
        undefined,
      ],
      undefined,
    ];
    const result = failedValidation(errors);
    expect(result).toEqual({
      data: undefined,
      errors: [
        invalidEServiceState(itemState.inactive),
        invalidAgreementState(undefined),
      ],
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
