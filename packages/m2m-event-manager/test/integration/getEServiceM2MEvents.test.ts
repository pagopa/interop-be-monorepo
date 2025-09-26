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
      getMockedEServiceM2MEvent({ eventType }),
      getMockedEServiceM2MEvent({
        eventType,
        visibility: m2mEventVisibility.restricted,
      }),
      getMockedEServiceM2MEvent({
        eventType,
        visibility: m2mEventVisibility.restricted,
        producerId: mockProducerId,
      }),
      getMockedEServiceM2MEvent({
        eventType,
        visibility: m2mEventVisibility.restricted,
        producerId: mockProducerId,
        producerDelegateId: mockProducerDelegateId,
      }),
    ])
    .flat();

  const publicEventsCount = EServiceM2MEventType.options.length;
  const restrictedToProducerCount = EServiceM2MEventType.options.length * 2;
  const restrictedToProducerAndDelegateCount =
    EServiceM2MEventType.options.length;

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

  it("should also list restricted eservice M2M events (requester = producerId)", async () => {
    const restrictedEvents = mockEServiceM2MEvents.filter(
      (e) =>
        e.visibility === m2mEventVisibility.public ||
        (e.visibility === m2mEventVisibility.restricted &&
          e.producerId === mockProducerId)
    );

    const events = await m2mEventService.getEServiceM2MEvents(
      undefined,
      restrictedEvents.length,
      getMockContextM2M({
        organizationId: mockProducerId,
      })
    );
    expect(events).toEqual(restrictedEvents);
    expect(events.length).toEqual(
      restrictedToProducerCount + publicEventsCount
    );
  });

  it("should also list also restricted eservice M2M events (requester = producerDelegateId)", async () => {
    const restrictedEvents = mockEServiceM2MEvents.filter(
      (e) =>
        e.visibility === m2mEventVisibility.public ||
        (e.visibility === m2mEventVisibility.restricted &&
          e.producerDelegateId === mockProducerDelegateId)
    );

    const events = await m2mEventService.getEServiceM2MEvents(
      undefined,
      restrictedEvents.length,
      getMockContextM2M({
        organizationId: mockProducerDelegateId,
      })
    );
    expect(events).toEqual(restrictedEvents);
    expect(events.length).toEqual(
      restrictedToProducerAndDelegateCount + publicEventsCount
    );
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
      const lastEventId = mockEServiceM2MEvents[1].id;
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
