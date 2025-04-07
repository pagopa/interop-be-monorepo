/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { multipleTopicMessage, singleTopicMessage } from "./utils.js";

beforeEach(() => {
  vi.clearAllMocks();
});

vi.mock("pagopa-interop-commons", async (importOriginal) => {
  const actual = await importOriginal();
  return Object.assign({}, actual, {
    decodeKafkaMessage: vi.fn((msg: any) => msg.value),
  });
});

async function setupHandlerAfterMock() {
  return (await import("../src/handlers/messageHandler.js"))
    .handleTopicMessages;
}

const mockAttributeHandler = vi.fn().mockResolvedValue(undefined);
const mockCatalogHandler = vi.fn().mockResolvedValue(undefined);
const mockAgreementV1Handler = vi.fn().mockResolvedValue(undefined);
const mockAgreementV2Handler = vi.fn().mockResolvedValue(undefined);

vi.doMock("../src/handlers/attribute/consumerServiceV1.js", () => ({
  handleAttributeMessageV1: mockAttributeHandler,
}));
vi.doMock("../src/handlers/catalog/consumerServiceV2.js", () => ({
  handleCatalogMessageV2: mockCatalogHandler,
}));
vi.doMock("../src/handlers/agreement/consumerServiceV1.js", () => ({
  handleAgreementMessageV1: mockAgreementV1Handler,
}));
vi.doMock("../src/handlers/agreement/consumerServiceV2.js", () => ({
  handleAgreementMessageV2: mockAgreementV2Handler,
}));

describe("handleTopicMessages", () => {
  it("should handle correctly single topic and event version", async () => {
    const handleTopicMessages = await setupHandlerAfterMock();

    await Promise.all(await handleTopicMessages(singleTopicMessage, {} as any));

    expect(mockAttributeHandler).toHaveBeenCalledOnce();
  });
  it("should correctly dispatch mutiple topics and event version", async () => {
    const handleTopicMessages = await setupHandlerAfterMock();

    await Promise.all(
      await handleTopicMessages(multipleTopicMessage, {} as any)
    );

    expect(mockAttributeHandler).toHaveBeenCalledOnce();
    expect(mockAgreementV1Handler).toHaveBeenCalledOnce();
    expect(mockAgreementV2Handler).toHaveBeenCalledOnce();
    expect(mockCatalogHandler).toHaveBeenCalledOnce();
  });
  it("should throw genericInternalError for unknown topic", async () => {
    const handleTopicMessages = await setupHandlerAfterMock();

    const unknownPayload = [
      {
        topic: "mock-topic-name",
        message: { value: { event_version: 1 } },
      },
    ] as any;

    await expect(
      handleTopicMessages(unknownPayload, {} as any)
    ).rejects.toThrow("Unknown topic");
  });
});
