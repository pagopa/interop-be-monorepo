import { describe, expect, it } from "vitest";

import { getErrorCode } from "../src/utils/parseErrorCode.js";

describe("getErrorCode", () => {
  it.each([
    ["Tenant Process", "005"],
    ["tenantProcess", "005"],
    [" TENANT-PROCESS ", "005"],
    ["Agreement Process", "002"],
    ["Attribute Registry Process", "003"],
    ["Authorization Process", "006"],
    ["Catalog Process", "001"],
    ["Delegation Process", "010"],
    ["e-service template process", "011"],
    ["Notification Config Process", "014"],
    ["Purpose Process", "004"],
    ["Purpose-template Process", "015"],
    ["BFF Process", "008"],
    ["Backend for frontend Process", "008"],
  ])("resolves common errors for %s", (process, prefix) => {
    expect(getErrorCode(process, "genericError")).toBe(`${prefix}-9991`);
  });

  it("resolves process-specific errors", () => {
    expect(
      getErrorCode("Tenant Process", "certifiedAttributeAlreadyAssigned")
    ).toBe("005-0014");
  });

  it.each([
    ["Agreement Process", "missingCertifiedAttributesError", "002-0001"],
    ["Attribute Registry Process", "attributeNotFound", "003-0001"],
    ["Authorization Process", "clientNotFound", "006-0001"],
    ["BFF Process", "purposeNotFound", "008-0001"],
    ["Catalog Process", "eServiceDescriptorNotFound", "001-0001"],
    ["Delegation Process", "delegationNotFound", "010-0001"],
    ["EService Template Process", "eserviceTemplateNotFound", "011-0001"],
    [
      "Notification Config Process",
      "tenantNotificationConfigNotFound",
      "014-0001",
    ],
    ["Purpose Process", "purposeNotFound", "004-0001"],
    ["Purpose Template Process", "missingFreeOfChargeReason", "015-0001"],
    ["Tenant Process", "attributeNotFound", "005-0001"],
  ])("uses the correct error map for %s", (process, error, expected) => {
    expect(getErrorCode(process, error)).toBe(expected);
  });

  it.each([
    ["Unknown Process", "genericError"],
    ["Tenant Process", "unknownError"],
    ["Tenant Process", " certifiedAttributeAlreadyAssigned "],
    ["Tenant Process", "toString"],
    ["Tenant Process", "constructor"],
    ["", ""],
  ])("returns null for unresolved %s / %s", (process, error) => {
    expect(getErrorCode(process, error)).toBeNull();
  });
});
