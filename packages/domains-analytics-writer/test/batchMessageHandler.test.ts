/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { KafkaMessage } from "kafkajs";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { mockAttributeBatch } from "./utilsAttribute.js";
import { mockCatalogBatch } from "./utilsCatalog.js";
import { mockTenantBatch } from "./utilsTenant.js";

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
const mockTenantV3Handler = vi.fn().mockResolvedValue(undefined);

vi.doMock("../src/handlers/tenant/consumerServiceV1.js", () => ({
  handleTenantMessageV1: mockTenantV1Handler,
}));

vi.doMock("../src/handlers/tenant/consumerServiceV2.js", () => ({
  handleTenantMessageV2: mockTenantV2Handler,
}));

vi.doMock("../src/handlers/tenant/consumerServiceV3.js", () => ({
  handleTenantMessageV3: mockTenantV3Handler,
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

  it("should dispatch tenant V1, V2 and V3 events of the same batch, handling V3 last", async () => {
    const executeTopicHandler = await setupHandlerAfterMock();
    await executeTopicHandler(
      mockTenantBatch.messages,
      mockTenantBatch.topic,
      {} as any
    );

    expect(mockTenantV1Handler).toHaveBeenCalledOnce();
    expect(mockTenantV2Handler).toHaveBeenCalledOnce();
    expect(mockTenantV3Handler).toHaveBeenCalledOnce();
    expect(mockTenantV3Handler.mock.calls[0][0]).toEqual([
      { event_version: 3 },
    ]);
    expect(mockTenantV2Handler.mock.invocationCallOrder[0]).toBeLessThan(
      mockTenantV3Handler.mock.invocationCallOrder[0]
    );
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
