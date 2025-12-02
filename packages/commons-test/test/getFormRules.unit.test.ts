import {
  getFormRulesByVersion,
  getLatestVersionFormRules,
  getRulesetExpiration,
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

  describe("getRulesetExpiration", () => {
    it("should return undefined if kind is undefined", () => {
      const expiration = getRulesetExpiration(undefined, "2.0");
      expect(expiration).toBeUndefined();
    });
    it("should return undefined for 3.1 PA version", () => {
      const expiration = getRulesetExpiration(tenantKind.PA, "3.1");
      expect(expiration).toBeUndefined();
    });
    it("should return undefined for 2.0 Private version", () => {
      const expiration = getRulesetExpiration(tenantKind.PRIVATE, "2.0");
      expect(expiration).toBeUndefined();
    });
    it("should return the expiration for 3.0 PA version", () => {
      const expiration = getRulesetExpiration(tenantKind.PA, "3.0");
      expect(expiration).toEqual(new Date("2026-02-15T23:59:59"));
    });
  });
});
