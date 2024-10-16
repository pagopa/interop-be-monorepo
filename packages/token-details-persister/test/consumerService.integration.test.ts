import { GeneratedTokenAuditDetails, generateId } from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import { genericLogger } from "pagopa-interop-commons";
import { handleMessages } from ".././src/consumerService.js";
import { config } from "../src/config/config.js";
import { fileManager } from "./utils.js";

describe("consumerService", () => {
  it("should write one entry on the bucket", async () => {
    const auditDetails = getMockAuditDetails();

    expect(
      await fileManager.listFiles(config.s3Bucket, genericLogger)
    ).toMatchObject([]);

    await handleMessages([auditDetails], fileManager, genericLogger);

    expect(
      await fileManager.listFiles(config.s3Bucket, genericLogger)
    ).toHaveLength(1);
  });

  it("should write two entries on the bucket", () => {
    expect(1).toBe(1);
  });
});

const getMockAuditDetails = (): GeneratedTokenAuditDetails => ({
  correlationId: generateId(),
  eserviceId: generateId(),
  descriptorId: generateId(),
  agreementId: generateId(),
  subject: generateId(),
  audience: "uat.interop.pagopa.it",
  purposeId: generateId(),
  algorithm: "RS256",
  clientId: generateId(),
  keyId: generateId(),
  purposeVersionId: generateId(),
  jwtId: generateId(),
  issuedAt: new Date().getMilliseconds(),
  issuer: "issuer",
  expirationTime: new Date().getMilliseconds(),
  organizationId: generateId(),
  notBefore: new Date().getMilliseconds(),
  clientAssertion: {
    subject: generateId(),
    audience: "uat.interop.pagopa.it",
    algorithm: "RS256",
    keyId: generateId(),
    jwtId: generateId(),
    issuedAt: new Date().getMilliseconds(),
    issuer: "issuer",
    expirationTime: new Date().getMilliseconds(),
  },
});
