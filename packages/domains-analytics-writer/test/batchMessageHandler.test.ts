/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { KafkaMessage } from "kafkajs";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { config } from "../src/config/config.js";
import { mockAttributeBatch } from "./utilsAttribute.js";
import { mockCatalogBatch } from "./utilsCatalog.js";

beforeEach(() => {
  vi.clearAllMocks();
});

vi.mock("pagopa-interop-commons", async (importOriginal) => {
  const actual = await importOriginal();
  return Object.assign({}, actual, {
    decodeKafkaMessage: vi.fn((msg: KafkaMessage) => msg.value),
  });
});

async function setupHandlerAfterMock() {
  return (await import("../src/handlers/batchMessageHandler.js"))
    .executeTopicHandler;
}

const mockAttributeHandler = vi.fn().mockResolvedValue(undefined);
const mockCatalogV1Handler = vi.fn().mockResolvedValue(undefined);
const mockCatalogV2Handler = vi.fn().mockResolvedValue(undefined);

vi.doMock("../src/handlers/attribute/consumerServiceV1.js", () => ({
  handleAttributeMessageV1: mockAttributeHandler,
}));

vi.doMock("../src/handlers/catalog/consumerServiceV1.js", () => ({
  handleCatalogMessageV1: mockCatalogV1Handler,
}));

vi.doMock("../src/handlers/catalog/consumerServiceV2.js", () => ({
  handleCatalogMessageV2: mockCatalogV2Handler,
}));

const mockTenantV1Handler = vi.fn().mockResolvedValue(undefined);
const mockTenantV2Handler = vi.fn().mockResolvedValue(undefined);

vi.doMock("../src/handlers/tenant/consumerServiceV1.js", () => ({
  handleTenantMessageV1: mockTenantV1Handler,
}));

vi.doMock("../src/handlers/tenant/consumerServiceV2.js", () => ({
  handleTenantMessageV2: mockTenantV2Handler,
}));

describe("executeTopicHandler", () => {
  it("should handle correctly topic and event version", async () => {
    const executeTopicHandler = await setupHandlerAfterMock();
    await executeTopicHandler(
      mockAttributeBatch.messages,
      mockAttributeBatch.topic,
      {} as any
    );
    expect(mockAttributeHandler).toHaveBeenCalledOnce();
  });

  it("should correctly dispatch topic and multiple event version", async () => {
    const executeTopicHandler = await setupHandlerAfterMock();
    await executeTopicHandler(
      mockCatalogBatch.messages,
      mockCatalogBatch.topic,
      {} as any
    );

    expect(mockCatalogV1Handler).toHaveBeenCalledOnce();
    expect(mockCatalogV2Handler).toHaveBeenCalledOnce();
  });

  it("should reject a tenant batch containing a V3 event without writing any tenant event", async () => {
    const executeTopicHandler = await setupHandlerAfterMock();
    // The V3 event comes after V1 and V2 events of the same batch: none of
    // them must be written.
    const mixedVersionTenantMessages = [
      { value: { event_version: 1, type: "TenantCreated" } },
      { value: { event_version: 2, type: "TenantOnboarded" } },
      { value: { event_version: 3, type: "TenantOnboarded" } },
    ] as unknown as KafkaMessage[];

    await expect(
      executeTopicHandler(
        mixedVersionTenantMessages,
        config.tenantTopic,
        {} as any
      )
    ).rejects.toThrow("Tenant event V3 not supported yet: TenantOnboarded");

    expect(mockTenantV1Handler).not.toHaveBeenCalled();
    expect(mockTenantV2Handler).not.toHaveBeenCalled();
  });

  it("should throw genericInternalError for unknown topic", async () => {
    const executeTopicHandler = await setupHandlerAfterMock();
    const unknownPayload = [
      {
        topic: "mock-topic-name",
        message: { value: { event_version: 1 } },
      },
    ] as any;
    await expect(
      executeTopicHandler(unknownPayload, "mock-topic-name", {} as any)
    ).rejects.toThrow("Unknown topic");
  });
});
