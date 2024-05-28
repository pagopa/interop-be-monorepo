import { getFormRulesByVersion, pa1, private1 } from "pagopa-interop-commons";
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
});
