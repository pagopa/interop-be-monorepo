import { beforeEach, describe, expect, it } from "vitest";
import { getMockContextM2M } from "pagopa-interop-commons-test";
import {
  ProducerKeychainM2MEventType,
  TenantId,
  generateId,
  m2mEventVisibility,
} from "pagopa-interop-models";
import { getMockedProducerKeychainM2MEvent } from "../mockUtils.js";
import {
  m2mEventService,
  writeProducerKeychainM2MEvent,
} from "../integrationUtils.js";

describe("getProducerKeychainM2MEvents", () => {
  const mockProducerId: TenantId = generateId();

  const mockProducerKeychainM2MEvents = ProducerKeychainM2MEventType.options
    .map((eventType) => [
      getMockedProducerKeychainM2MEvent({
        eventType,
        visibility: m2mEventVisibility.public,
      }),
      getMockedProducerKeychainM2MEvent({
        eventType,
        visibility: m2mEventVisibility.owner,
        producerId: mockProducerId,
        // Visible only to mockConsumer
      }),
      getMockedProducerKeychainM2MEvent({
        eventType,
        visibility: m2mEventVisibility.owner,
        // Visible only to some other consumer
      }),
    ])
    .flat();

  const publicEventsCount = ProducerKeychainM2MEventType.options.length;
  const eventsVisibleToConsumer =
    ProducerKeychainM2MEventType.options.length * 2; // public + owned by consumer

  beforeEach(async () => {
    await Promise.all(
      mockProducerKeychainM2MEvents.map(writeProducerKeychainM2MEvent)
    );
  });

  it("should list only public producerKeychain M2M events", async () => {
    const publicEvents = mockProducerKeychainM2MEvents.filter(
      (e) => e.visibility === m2mEventVisibility.public
    );

    const events = await m2mEventService.getProducerKeychainM2MEvents(
      undefined,
      publicEvents.length,
      getMockContextM2M({})
    );
    expect(events).toEqual(publicEvents);
    expect(events.length).toEqual(publicEventsCount);
  });

  it("should list public & owner producerKeychain M2M events (requester = producer)", async () => {
    const ownerEvents = mockProducerKeychainM2MEvents.filter(
      (e) =>
        e.visibility === m2mEventVisibility.public ||
        (e.visibility === m2mEventVisibility.owner &&
          e.producerId === mockProducerId)
    );

    const events = await m2mEventService.getProducerKeychainM2MEvents(
      undefined,
      ownerEvents.length,
      getMockContextM2M({
        organizationId: mockProducerId,
      })
    );
    expect(events).toEqual(ownerEvents);
    expect(events.length).toEqual(eventsVisibleToConsumer);
  });

  it.each([1, 3, 10])(
    "should list the %d oldest producerKeychain M2M events if lastEventId is not provided",
    async (limit) => {
      const events = await m2mEventService.getProducerKeychainM2MEvents(
        undefined,
        limit,
        getMockContextM2M({})
      );
      expect(events).toEqual(
        mockProducerKeychainM2MEvents
          .filter((e) => e.visibility === m2mEventVisibility.public)
          .slice(0, limit) // get the first N events
      );
    }
  );

  it.each([1, 3, 10])(
    "should list the %d oldest producerKeychain M2M events after the given lastEventId",
    async (limit) => {
      const lastEventId = mockProducerKeychainM2MEvents[limit].id;
      const events = await m2mEventService.getProducerKeychainM2MEvents(
        lastEventId,
        limit,
        getMockContextM2M({})
      );

      const filteredEvents = mockProducerKeychainM2MEvents
        .filter((e) => e.visibility === m2mEventVisibility.public)
        .filter((e) => e.id > lastEventId);

      expect(events).toEqual(
        filteredEvents.slice(0, limit) // get the first N events after the lastEventId
      );
    }
  );
});
