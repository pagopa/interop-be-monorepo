import { piiValidatorApi } from "pagopa-interop-api-clients";
import { describe, expect, it } from "vitest";

import { piiCategories } from "../../src/model/categories.js";
import { DetectionResponse } from "../../src/model/contracts.js";
import { detectCategories } from "../../src/services/recognizers.js";

const categories = [
  "EMAIL_ADDRESS",
  "IT_FISCAL_CODE",
  "IT_VAT_CODE",
  "IT_IBAN_CODE",
  "CREDIT_CARD",
  "IT_PHONE_NUMBER",
  "IT_CIE",
  "IT_DRIVER_LICENSE",
];

describe("approved category vocabulary", () => {
  it("keeps the service and generated API vocabulary aligned", () => {
    expect(piiCategories).toEqual(categories);
    expect(piiValidatorApi.PiiCategory.options).toEqual(categories);
  });

  it("returns the approved names from the real recognizers", () => {
    expect(
      detectCategories("IT60X0542811101000000123456; +39 3494096457")
    ).toEqual(["IT_IBAN_CODE", "IT_PHONE_NUMBER"]);
  });

  it.each(["IBAN_CODE", "PHONE_NUMBER", "IT_IDENTITY_CARD"])(
    "rejects the retired name %s in batch results",
    (category) => {
      const response = {
        results: [{ fieldId: "example", detectedCategories: [category] }],
      };
      expect(DetectionResponse.safeParse(response).success).toBe(false);
      expect(piiValidatorApi.PiiCategory.safeParse(category).success).toBe(
        false
      );
    }
  );

  it("preserves batch arrays and the deferred CIE vocabulary", () => {
    const response = {
      results: [{ fieldId: "example", detectedCategories: ["IT_CIE"] }],
    };
    expect(DetectionResponse.safeParse(response).success).toBe(true);
    expect(piiValidatorApi.DetectionResponse.safeParse(response).success).toBe(
      true
    );
    expect(detectCategories("CA12345AA U1T86I309C")).toEqual([]);
  });
});
