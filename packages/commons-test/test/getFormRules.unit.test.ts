import {
  getFormRulesByVersion,
  getLatestVersionFormRules,
  pa1,
  pa31,
  private1,
  private2,
} from "pagopa-interop-commons";
import { tenantKind } from "pagopa-interop-models";
import { describe, it, expect } from "vitest";

describe("Form rules retrieve", () => {
  describe("getFormRulesByVersion", () => {
    it.each(Object.values(tenantKind))(
      "should retrieve form rules of version 1.0 for kind %s",
      (kind) => {
        const riskAnalysisFormConfig = kind === tenantKind.PA ? pa1 : private1;
        expect(getFormRulesByVersion(kind, "1.0")).toEqual(
          riskAnalysisFormConfig
        );
      }
    );
    it("Should not retrieve form rules for unknown version", () => {
      expect(getFormRulesByVersion(tenantKind.PA, "0.0")).toBeUndefined();
    });
  });
  describe("getLatestVersionFormRules", () => {
    it.each(Object.values(tenantKind))(
      "should retrieve latest form rules for kind %s",
      (kind) => {
        const riskAnalysisFormConfig = kind === tenantKind.PA ? pa31 : private2; // TO BE UPDATED with latest versions
        expect(getLatestVersionFormRules(kind)).toEqual(riskAnalysisFormConfig);
      }
    );
  });
});
