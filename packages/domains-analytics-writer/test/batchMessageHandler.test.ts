/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { KafkaMessage } from "kafkajs";
import { mockAttributeBatch, mockCatalogBatch } from "./utils.js";

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
