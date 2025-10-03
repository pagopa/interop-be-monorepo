import { beforeEach, describe, expect, it } from "vitest";
import { getMockContextM2M } from "pagopa-interop-commons-test";
import {
  EServiceM2MEventType,
  TenantId,
  generateId,
  m2mEventVisibility,
} from "pagopa-interop-models";
import { getMockedEServiceM2MEvent } from "../mockUtils.js";
import { m2mEventService, writeEServiceM2MEvent } from "../integrationUtils.js";

describe("getEServiceM2MEvents", () => {
  const mockProducerId: TenantId = generateId();
  const mockProducerDelegateId: TenantId = generateId();

  const mockEServiceM2MEvents = EServiceM2MEventType.options
    .map((eventType) => [
      getMockedEServiceM2MEvent({
        eventType,
        visibility: m2mEventVisibility.public,
      }),
      getMockedEServiceM2MEvent({
        eventType,
        visibility: m2mEventVisibility.owner,
        producerId: mockProducerId,
        // Visible only to mockProducerId
      }),
      getMockedEServiceM2MEvent({
        eventType,
        visibility: m2mEventVisibility.owner,
        producerId: mockProducerId,
        producerDelegateId: mockProducerDelegateId,
        // Visible only to mockProducerId and mockProducerDelegateId
      }),

      getMockedEServiceM2MEvent({
        eventType,
        visibility: m2mEventVisibility.owner,
        // Visible only to some other producer
      }),
    ])
    .flat();

  const publicEventsCount = EServiceM2MEventType.options.length;
  const eventsVisibleToProducer = EServiceM2MEventType.options.length * 3; // public + owner (all)
  const eventsVisibleToProducerDelegate =
    EServiceM2MEventType.options.length * 2; // public + owner (only with delegate)

  beforeEach(async () => {
    await Promise.all(mockEServiceM2MEvents.map(writeEServiceM2MEvent));
  });

  it("should list only public eservice M2M events", async () => {
    const publicEvents = mockEServiceM2MEvents.filter(
      (e) => e.visibility === m2mEventVisibility.public
    );

    const events = await m2mEventService.getEServiceM2MEvents(
      undefined,
      publicEvents.length,
      getMockContextM2M({})
    );
    expect(events).toEqual(publicEvents);
    expect(events.length).toEqual(publicEventsCount);
  });

  it("should list public & owner eservice M2M events (requester = producerId)", async () => {
    const ownerEvents = mockEServiceM2MEvents.filter(
      (e) =>
        e.visibility === m2mEventVisibility.public ||
        (e.visibility === m2mEventVisibility.owner &&
          e.producerId === mockProducerId)
    );

    const events = await m2mEventService.getEServiceM2MEvents(
      undefined,
      ownerEvents.length,
      getMockContextM2M({
        organizationId: mockProducerId,
      })
    );
    expect(events).toEqual(ownerEvents);
    expect(events.length).toEqual(eventsVisibleToProducer);
  });

  it("should list public & owner eservice M2M events (requester = producerDelegateId)", async () => {
    const ownerEvents = mockEServiceM2MEvents.filter(
      (e) =>
        e.visibility === m2mEventVisibility.public ||
        (e.visibility === m2mEventVisibility.owner &&
          e.producerDelegateId === mockProducerDelegateId)
    );

    const events = await m2mEventService.getEServiceM2MEvents(
      undefined,
      ownerEvents.length,
      getMockContextM2M({
        organizationId: mockProducerDelegateId,
      })
    );
    expect(events).toEqual(ownerEvents);
    expect(events.length).toEqual(eventsVisibleToProducerDelegate);
  });

  it.each([1, 3, 10])(
    "should list the %d oldest eservice M2M events if lastEventId is not provided",
    async (limit) => {
      const events = await m2mEventService.getEServiceM2MEvents(
        undefined,
        limit,
        getMockContextM2M({})
      );
      expect(events).toEqual(
        mockEServiceM2MEvents
          .filter((e) => e.visibility === m2mEventVisibility.public)
          .slice(0, limit) // get the first N events
      );
    }
  );

  it.each([1, 3, 10])(
    "should list the %d oldest eservice M2M events after the given lastEventId",
    async (limit) => {
      const lastEventId = mockEServiceM2MEvents[limit].id;
      const events = await m2mEventService.getEServiceM2MEvents(
        lastEventId,
        limit,
        getMockContextM2M({})
      );

      const filteredEvents = mockEServiceM2MEvents
        .filter((e) => e.visibility === m2mEventVisibility.public)
        .filter((e) => e.id > lastEventId);

      expect(events).toEqual(
        filteredEvents.slice(0, limit) // get the first N events after the lastEventId
      );
    }
  );
});
