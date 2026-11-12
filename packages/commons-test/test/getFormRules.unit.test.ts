import {
  getFormRulesByVersion,
  getLatestVersionFormRules,
  getRulesetExpiration,
  getValidFormRulesVersions,
  pa1,
  pa32,
  private1,
  private21,
} from "pagopa-interop-commons";
import { tenantKind } from "pagopa-interop-models";
import { describe, it, expect, vi } from "vitest";

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
        const riskAnalysisFormConfig =
          kind === tenantKind.PA ? pa32 : private21; // TO BE UPDATED with latest versions
        expect(getLatestVersionFormRules(kind)).toEqual(riskAnalysisFormConfig);
      }
    );
  });

  describe("getRulesetExpiration", () => {
    it("should return undefined if kind is undefined", () => {
      const expiration = getRulesetExpiration(undefined, "2.0");
      expect(expiration).toBeUndefined();
    });
    it("should return undefined for 3.2 PA version", () => {
      const expiration = getRulesetExpiration(tenantKind.PA, "3.2");
      expect(expiration).toBeUndefined();
    });
    it("should return undefined for 2.1 Private version", () => {
      const expiration = getRulesetExpiration(tenantKind.PRIVATE, "2.1");
      expect(expiration).toBeUndefined();
    });
    it("should return the expiration for 3.0 PA version", () => {
      const expiration = getRulesetExpiration(tenantKind.PA, "3.0");
      expect(expiration).toEqual(new Date("2026-02-15T23:59:59"));
    });
    it("should return the expiration for 3.1 PA version", () => {
      const expiration = getRulesetExpiration(tenantKind.PA, "3.1");
      expect(expiration).toEqual(new Date("2027-06-30T23:59:59"));
    });
    it("should return the expiration for 2.0 Private version", () => {
      const expiration = getRulesetExpiration(tenantKind.PRIVATE, "2.0");
      expect(expiration).toEqual(new Date("2027-06-30T23:59:59"));
    });
  });

  describe("getValidFormRulesVersions", () => {
    it("should keep PA 3.1 and PRIVATE 2.0 valid until their extended expiration", () => {
      vi.useFakeTimers();
      try {
        const expectedLatestVersions = {
          [tenantKind.PA]: "3.2",
          [tenantKind.PRIVATE]: "2.1",
        };

        for (const [date, isExtendedRulesetValid] of [
          ["2026-10-30T12:00:00", true],
          ["2026-11-01T12:00:00", true],
          ["2027-07-01T00:00:00", false],
        ] as const) {
          vi.setSystemTime(new Date(date));
          const validVersions = getValidFormRulesVersions();

          expect(validVersions.get(tenantKind.PA)).toContain("3.2");
          expect(validVersions.get(tenantKind.PRIVATE)).toContain("2.1");
          expect(getLatestVersionFormRules(tenantKind.PA)?.version).toBe(
            expectedLatestVersions[tenantKind.PA]
          );
          expect(getLatestVersionFormRules(tenantKind.PRIVATE)?.version).toBe(
            expectedLatestVersions[tenantKind.PRIVATE]
          );

          if (isExtendedRulesetValid) {
            expect(validVersions.get(tenantKind.PA)).toContain("3.1");
            expect(validVersions.get(tenantKind.PRIVATE)).toContain("2.0");
          } else {
            expect(validVersions.get(tenantKind.PA)).not.toContain("3.1");
            expect(validVersions.get(tenantKind.PRIVATE)).not.toContain("2.0");
          }
        }
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
