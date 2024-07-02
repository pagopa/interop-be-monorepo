import { describe, it } from "vitest";

describe("m2mRevokeCertifiedAttribute", () => {
  it("should write on event-store for the revokation of a certified attribute", () => {});
  it("should throw tenantNotFound if the requester tenant doesn't exist", () => {});
  it("should throw tenantIsNotACertifier if the requester is not a certifier", () => {});
  it("should throw tenantNotFoundByExternalId if the target tenant doesn't exist", () => {});
  it("should throw attributeNotFound if the attribute doesn't exist", () => {});
  it(
    "should throw attributeNotFoundInTenant if the target tenant didn't have that attribute"
  );
});
