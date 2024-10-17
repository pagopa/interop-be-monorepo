/* eslint-disable @typescript-eslint/no-floating-promises */
import { GeneratedTokenAuditDetails, generateId } from "pagopa-interop-models";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  formatDateyyyyMMdd,
  formatTimehhmmss,
  genericLogger,
} from "pagopa-interop-commons";
import * as uuidv4 from "uuid";
import { handleMessages } from ".././src/consumerService.js";
import { config } from "../src/config/config.js";
import { fileManager } from "./utils.js";

describe("consumerService", () => {
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
    const uuid = generateId();
    vi.spyOn(uuidv4, "v4").mockReturnValue(uuid);
  });
  afterAll(() => {
    vi.useRealTimers();
  });

  it("should write one entry on the bucket", async () => {
    const auditMessages: GeneratedTokenAuditDetails[] = [getMockAuditDetails()];

    expect(
      await fileManager.listFiles(config.s3Bucket, genericLogger)
    ).toMatchObject([]);

    await handleMessages(auditMessages, fileManager, genericLogger);

    const date = new Date();
    const ymdDate = formatDateyyyyMMdd(date);
    const hmsTime = formatTimehhmmss(date);
    const expectedFileName = `${ymdDate}_${hmsTime}_${generateId()}.ndjson`;
    const expectedFilePathWithFileName = `token-details/${ymdDate}/${expectedFileName}`;

    const fileList = await fileManager.listFiles(
      config.s3Bucket,
      genericLogger
    );
    expect(fileList).toHaveLength(1);
    expect(fileList).toMatchObject([expectedFilePathWithFileName]);

    const expectedFileContent = JSON.stringify(auditMessages[0]) + "\n";

    const fileContent = await fileManager.get(
      config.s3Bucket,
      expectedFilePathWithFileName,
      genericLogger
    );

    const decodedFileContent = new TextDecoder().decode(fileContent);

    expect(decodedFileContent).toMatchObject(expectedFileContent);
  });

  it("should write three entries on the bucket", async () => {
    const auditMessages: GeneratedTokenAuditDetails[] = [
      getMockAuditDetails(),
      getMockAuditDetails(),
      getMockAuditDetails(),
    ];

    expect(
      await fileManager.listFiles(config.s3Bucket, genericLogger)
    ).toMatchObject([]);

    await handleMessages(auditMessages, fileManager, genericLogger);

    const date = new Date();
    const ymdDate = formatDateyyyyMMdd(date);
    const hmsTime = formatTimehhmmss(date);
    const expectedFileName = `${ymdDate}_${hmsTime}_${generateId()}.ndjson`;
    const expectedFilePathWithFileName = `token-details/${ymdDate}/${expectedFileName}`;

    const fileList = await fileManager.listFiles(
      config.s3Bucket,
      genericLogger
    );

    expect(fileList).toHaveLength(1);
    expect(fileList).toMatchObject([expectedFilePathWithFileName]);

    const expectedFileContent =
      auditMessages
        .map((auditingEntry) => JSON.stringify(auditingEntry))
        .join("\n") + "\n";

    const fileContent = await fileManager.get(
      config.s3Bucket,
      expectedFilePathWithFileName,
      genericLogger
    );

    const decodedFileContent = new TextDecoder().decode(fileContent);

    expect(decodedFileContent).toMatchObject(expectedFileContent);
  });

  it("should throw error if write operation fails", async () => {
    const auditMessages: GeneratedTokenAuditDetails[] = [getMockAuditDetails()];
    vi.spyOn(fileManager, "storeBytes").mockRejectedValueOnce(() => {
      throw Error();
    });

    expect(
      await fileManager.listFiles(config.s3Bucket, genericLogger)
    ).toMatchObject([]);

    expect(
      handleMessages(auditMessages, fileManager, genericLogger)
    ).rejects.toThrowError("auditing failed");
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
