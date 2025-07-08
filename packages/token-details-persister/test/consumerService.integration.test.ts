/* eslint-disable @typescript-eslint/no-floating-promises */
import crypto from "crypto";
import {
  algorithm,
  GeneratedTokenAuditDetails,
  generateId,
} from "pagopa-interop-models";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  formatDateyyyyMMdd,
  formatTimehhmmss,
  genericLogger,
} from "pagopa-interop-commons";
import { KafkaMessage } from "kafkajs";
import { handleMessages } from ".././src/consumerService.js";
import { config } from "../src/config/config.js";
import { fileManager } from "./utils.js";

describe("consumerService", () => {
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
    const uuid = crypto.randomUUID();
    vi.spyOn(crypto, "randomUUID").mockReturnValue(uuid);
  });
  afterAll(() => {
    vi.useRealTimers();
  });

  it("should write one entry on the bucket", async () => {
    const auditMessage = getMockAuditDetails();

    const kafkaMessages: KafkaMessage[] = [
      {
        key: Buffer.from(generateId()),
        value: Buffer.from(JSON.stringify(auditMessage)),
        timestamp: new Date().toISOString(),
        offset: "0",
        attributes: 1,
        size: 100,
      },
    ];
    expect(
      await fileManager.listFiles(config.s3Bucket, genericLogger)
    ).toMatchObject([]);

    await handleMessages(kafkaMessages, fileManager, genericLogger);

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

    const expectedFileContent = JSON.stringify(auditMessage);

    const fileContent = await fileManager.get(
      config.s3Bucket,
      expectedFilePathWithFileName,
      genericLogger
    );

    const decodedFileContent = Buffer.from(fileContent).toString();
    expect(decodedFileContent).toEqual(expectedFileContent);
  });

  it("should write three entries on the bucket", async () => {
    const auditMessages: GeneratedTokenAuditDetails[] = [
      getMockAuditDetails(),
      getMockAuditDetails(),
      getMockAuditDetails(),
    ];

    const kafkaMessages: KafkaMessage[] = auditMessages.map(
      (auditMessage, index) => ({
        key: Buffer.from(generateId()),
        value: Buffer.from(JSON.stringify(auditMessage)),
        timestamp: new Date().toISOString(),
        offset: index.toString(),
        attributes: 1,
        size: 100,
      })
    );
    expect(
      await fileManager.listFiles(config.s3Bucket, genericLogger)
    ).toMatchObject([]);

    await handleMessages(kafkaMessages, fileManager, genericLogger);

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

    const expectedFileContent = auditMessages
      .map((auditingEntry) => JSON.stringify(auditingEntry))
      .join("\n");

    const fileContent = await fileManager.get(
      config.s3Bucket,
      expectedFilePathWithFileName,
      genericLogger
    );

    const decodedFileContent = Buffer.from(fileContent).toString();
    expect(decodedFileContent).toEqual(expectedFileContent);
  });

  it("should throw error if write operation fails", async () => {
    const auditMessage = getMockAuditDetails();

    const kafkaMessages: KafkaMessage[] = [
      {
        key: Buffer.from(generateId()),
        value: Buffer.from(JSON.stringify(auditMessage)),
        timestamp: new Date().toISOString(),
        offset: "0",
        attributes: 1,
        size: 100,
      },
    ];

    vi.spyOn(fileManager, "storeBytes").mockRejectedValueOnce(() => {
      throw Error();
    });

    expect(
      await fileManager.listFiles(config.s3Bucket, genericLogger)
    ).toMatchObject([]);

    expect(
      handleMessages(kafkaMessages, fileManager, genericLogger)
    ).rejects.toThrowError("Write operation failed - generic error");
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
  algorithm: algorithm.RS256,
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
    algorithm: algorithm.RS256,
    keyId: generateId(),
    jwtId: generateId(),
    issuedAt: new Date().getMilliseconds(),
    issuer: "issuer",
    expirationTime: new Date().getMilliseconds(),
  },
});
