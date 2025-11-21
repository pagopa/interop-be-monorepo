import { beforeEach, describe, expect, it, vi } from "vitest";
import { getMockTenant, toTenantV1 } from "pagopa-interop-commons-test";
import {
  toTenantV2,
  TenantEvent,
  TenantEventV2,
  TenantEventEnvelopeV2,
  TenantEventEnvelopeV1,
} from "pagopa-interop-models";
import { genericLogger } from "pagopa-interop-commons";
import { EachMessagePayload, KafkaMessage } from "kafkajs";
import { handleTenantEvent } from "../src/handlers/handleTenantEvent.js";
import {
  bigIntReplacer,
  getMockEventEnvelopeCommons,
  mockProcessMessage,
  retrieveAllTenantM2MEvents,
  retrieveLastTenantM2MEvent,
  testM2mEventWriterService,
  TopicNames,
} from "./utils.js";

describe("handleTenantEvent test", async () => {
  const tenant = getMockTenant();
  vi.spyOn(testM2mEventWriterService, "insertTenantM2MEvent");

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(TenantEventV2.options.map((o) => o.shape.type.value))(
    "should write %s M2M event with the right visibility",
    async (eventType: TenantEvent["type"]) => {
      const message = {
        ...getMockEventEnvelopeCommons(),
        stream_id: tenant.id,
        type: eventType,
        data: {
          tenant: toTenantV2(tenant),
        },
      } as TenantEventEnvelopeV2;

      const eventTimestamp = new Date();

      const expectedM2MEvent = {
        id: expect.any(String),
        eventType,
        eventTimestamp,
        resourceVersion: message.version,
        tenantId: tenant.id,
      };

      await handleTenantEvent(
        message,
        eventTimestamp,
        genericLogger,
        testM2mEventWriterService
      );

      if (!expectedM2MEvent) {
        expect(
          testM2mEventWriterService.insertTenantM2MEvent
        ).not.toHaveBeenCalled();
      } else {
        expect(
          testM2mEventWriterService.insertTenantM2MEvent
        ).toHaveBeenCalledTimes(1);
        const actualM2MEvent = await retrieveLastTenantM2MEvent();
        expect(actualM2MEvent).toEqual(expectedM2MEvent);
      }
    }
  );

  it("should not write the event if the same resource version is already present", async () => {
    const message = {
      ...getMockEventEnvelopeCommons(),
      stream_id: tenant.id,
      type: "TenantOnboarded",
      data: {
        tenant: toTenantV2(tenant),
      },
    } as TenantEventEnvelopeV2;

    const eventTimestamp = new Date();

    // Insert the event for the first time
    await handleTenantEvent(
      message,
      eventTimestamp,
      genericLogger,
      testM2mEventWriterService
    );

    // Try to insert the same event again: should be skipped
    await handleTenantEvent(
      message,
      eventTimestamp,
      genericLogger,
      testM2mEventWriterService
    );

    // Try to insert one with a further resource version: should be inserted
    await handleTenantEvent(
      { ...message, version: message.version + 1 },
      eventTimestamp,
      genericLogger,
      testM2mEventWriterService
    );

    expect(
      testM2mEventWriterService.insertTenantM2MEvent
    ).toHaveBeenCalledTimes(3);

    expect(await retrieveAllTenantM2MEvents({ limit: 10 })).toHaveLength(2);
  });
});

describe("V1 Event Skipping", () => {
  it("should skip V1 events by not calling insertTenantM2MEvent and resolving", async () => {
    vi.clearAllMocks();

    const tenant = getMockTenant();
    const message: TenantEventEnvelopeV1 = {
      ...getMockEventEnvelopeCommons(),
      stream_id: tenant.id,
      type: "TenantCreated",
      event_version: 1,
      data: {
        tenant: toTenantV1(tenant),
      },
    };

    const jsonString = JSON.stringify(message, bigIntReplacer);

    const kafkaMessage: KafkaMessage = {
      key: null,
      value: Buffer.from(jsonString),
      timestamp: "0",
      size: 0,
      attributes: 0,
      offset: "0",
      headers: undefined,
    };

    const eachMessagePayload: EachMessagePayload = {
      topic: "event-store.tenant.events",
      partition: 0,
      message: kafkaMessage,
      heartbeat: async () => {
        /* no-op in mock */
      },
      pause: () => () => {
        /* no-op in mock */
      },
    };

    await mockProcessMessage({
      tenantTopic: "event-store.tenant.events",
    } as TopicNames)(eachMessagePayload);

    expect(
      testM2mEventWriterService.insertTenantM2MEvent
    ).not.toHaveBeenCalled();

    expect(await retrieveAllTenantM2MEvents({ limit: 10 })).toHaveLength(0);
  });
});
