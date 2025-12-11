import { gunzipSync } from "zlib";
import { describe, it, expect } from "vitest";
import { genericLogger } from "pagopa-interop-commons";
import { generateId } from "pagopa-interop-models";
import { prepareNdjsonEventData } from "../src/utils/ndjsonStore.js";
import {
  AuthorizationEventData,
  DelegationEventData,
} from "../src/models/eventTypes.js";

describe("prepareNdjsonEventData", () => {
  it("should prepare NDJSON data and return file details", async () => {
    const timestamp1 = new Date("2024-07-30T10:00:00Z");
    const timestamp2 = new Date("2024-07-31T11:00:00Z");
    const timestamp3 = new Date("2024-07-11T12:00:00Z");

    const mockEvents: DelegationEventData[] = [
      {
        id: generateId(),
        event_name: "ProducerDelegationApproved",
        eventTimestamp: timestamp1,
        state: "ACTIVE",
        correlationId: generateId(),
      },
      {
        id: generateId(),
        event_name: "ConsumerDelegationRevoked",
        eventTimestamp: timestamp2,
        state: "REVOKED",
        correlationId: generateId(),
      },
      {
        id: generateId(),
        event_name: "ProducerDelegationApproved",
        eventTimestamp: timestamp3,
        state: "ACTIVE",
        correlationId: generateId(),
      },
      {
        id: generateId(),
        event_name: "ConsumerDelegationApproved",
        eventTimestamp: timestamp1,
        state: "ACTIVE",
        correlationId: generateId(),
      },
    ];

    const preparedFiles = await prepareNdjsonEventData(
      mockEvents,
      genericLogger
    );

    expect(preparedFiles).toHaveLength(3);
    for (const file of preparedFiles) {
      expect(file).toHaveProperty("fileContentBuffer");
      expect(file.fileContentBuffer).toBeInstanceOf(Buffer);
      expect(file).toHaveProperty("fileName");
      expect(file).toHaveProperty("filePath");
    }
  });
  it("should verify correct JSON content for 'ClientDeleted' event", async () => {
    const timestamp = new Date("2024-08-01T10:00:00Z");
    const clientId = generateId();
    const correlationId = generateId();

    const clientDeletedEvent: AuthorizationEventData = {
      id: clientId,
      event_name: "ClientDeleted",
      eventTimestamp: timestamp,
      correlationId,
    } as AuthorizationEventData;

    const preparedFiles = await prepareNdjsonEventData(
      [clientDeletedEvent],
      genericLogger
    );

    expect(preparedFiles).toHaveLength(1);

    const decompressedBuffer = gunzipSync(preparedFiles[0].fileContentBuffer);

    const ndjsonContent = decompressedBuffer.toString("utf-8");

    const eventJsonString = ndjsonContent.trim().split("\n")[0];
    const eventJson = JSON.parse(eventJsonString);

    expect(eventJson).toStrictEqual({
      id: clientId,
      event_name: "ClientDeleted",
      timestamp: timestamp.toISOString(),
    });
  });
  it("should verify correct JSON content for 'ClientKeyDeleted' event", async () => {
    const timestamp = new Date("2024-08-01T10:00:00Z");
    const clientId = generateId();
    const correlationId = generateId();
    const kid = generateId();

    const clientKeyDeletedEvent: AuthorizationEventData = {
      id: clientId,
      event_name: "ClientKeyDeleted",
      kid,
      eventTimestamp: timestamp,
      correlationId,
    } as AuthorizationEventData;

    const preparedFiles = await prepareNdjsonEventData(
      [clientKeyDeletedEvent],
      genericLogger
    );

    expect(preparedFiles).toHaveLength(1);

    const decompressedBuffer = gunzipSync(preparedFiles[0].fileContentBuffer);
    const ndjsonContent = decompressedBuffer.toString("utf-8");
    const eventJsonString = ndjsonContent.trim().split("\n")[0];
    const eventJson = JSON.parse(eventJsonString);

    expect(eventJson).toStrictEqual({
      id: clientId,
      event_name: "ClientKeyDeleted",
      kid,
      timestamp: timestamp.toISOString(),
    });
  });
  it("should return an empty array if no events are provided", async () => {
    const mockEvents: DelegationEventData[] = [];

    const preparedFiles = await prepareNdjsonEventData(
      mockEvents,
      genericLogger
    );

    expect(preparedFiles).toHaveLength(0);
  });
});
