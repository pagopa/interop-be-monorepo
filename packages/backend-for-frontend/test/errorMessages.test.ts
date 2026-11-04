import { errorMessages, GeneratedErrorMessage } from "error-messages";
import { ErrorMessage } from "pagopa-interop-models";
import { describe, expect, expectTypeOf, it } from "vitest";

describe("shared error messages", () => {
  it("imports typed error messages from the shared package", () => {
    expectTypeOf<GeneratedErrorMessage>().toExtend<ErrorMessage>();
    expect(errorMessages.length).toBeGreaterThan(0);
    for (const message of errorMessages) {
      expect(message).toEqual({
        process: expect.any(String),
        error: expect.any(String),
        errorCode: expect.stringMatching(/^\d{3,4}-\d{3,5}$/),
        bffEndpoint: expect.any(String),
        copy: {
          it: expect.any(String),
          en: expect.any(String),
        },
      });
    }
  });
});
