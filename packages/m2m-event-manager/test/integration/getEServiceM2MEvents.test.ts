import { beforeEach, describe, expect, it } from "vitest";
import { getMockContextM2M } from "pagopa-interop-commons-test";
import {
  DelegationId,
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
  const mockProducerDelegationId: DelegationId = generateId();

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
        // Visible only to mockProducer
      }),
      getMockedEServiceM2MEvent({
        eventType,
        visibility: m2mEventVisibility.owner,
        producerId: mockProducerId,
        producerDelegateId: mockProducerDelegateId,
        producerDelegationId: mockProducerDelegationId,
        // Visible only to mockProducer and mockProducerDelegate
      }),
      getMockedEServiceM2MEvent({
        eventType,
        visibility: m2mEventVisibility.owner,
        producerId: mockProducerDelegateId, // some other producer
      }),
      getMockedEServiceM2MEvent({
        eventType,
        visibility: m2mEventVisibility.owner,
        // Visible only to some other producer
      }),
    ])
    .flat();

  const publicEventsCount = EServiceM2MEventType.options.length;
  const eventsWithDelegationIdCount = EServiceM2MEventType.options.length;
  const eventsVisibleToProducer = EServiceM2MEventType.options.length * 3; // public + owned by producer
  const eventsVisibleToProducerDelegate =
    EServiceM2MEventType.options.length * 3; // public + owned by delegate + delegated

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
      undefined,
      getMockContextM2M({})
    );
    expect(events).toEqual(publicEvents);
    expect(events.length).toEqual(publicEventsCount);
  });

  it("should list public & owner eservice M2M events (requester = producer)", async () => {
    const ownerEvents = mockEServiceM2MEvents.filter(
      (e) =>
        e.visibility === m2mEventVisibility.public ||
        (e.visibility === m2mEventVisibility.owner &&
          e.producerId === mockProducerId)
    );

    const events = await m2mEventService.getEServiceM2MEvents(
      undefined,
      ownerEvents.length,
      undefined,
      getMockContextM2M({
        organizationId: mockProducerId,
      })
    );
    expect(events).toEqual(ownerEvents);
    expect(events.length).toEqual(eventsVisibleToProducer);
  });

  it("should list public & owner eservice M2M events (requester = producerDelegate)", async () => {
    const ownerEvents = mockEServiceM2MEvents.filter(
      (e) =>
        e.visibility === m2mEventVisibility.public ||
        (e.visibility === m2mEventVisibility.owner &&
          (e.producerDelegateId === mockProducerDelegateId ||
            e.producerId === mockProducerDelegateId))
    );

    const events = await m2mEventService.getEServiceM2MEvents(
      undefined,
      ownerEvents.length,
      undefined,
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
        undefined,
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
        undefined,
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

  it("should apply delegationId filter (requester = producer / producerDelegate)", async () => {
    const expectedEvents = mockEServiceM2MEvents.filter(
      (e) => e.producerDelegationId === mockProducerDelegationId
    );

    const events1 = await m2mEventService.getEServiceM2MEvents(
      undefined,
      expectedEvents.length,
      mockProducerDelegationId,
      getMockContextM2M({
        organizationId: mockProducerId,
      })
    );

    const events2 = await m2mEventService.getEServiceM2MEvents(
      undefined,
      expectedEvents.length,
      mockProducerDelegationId,
      getMockContextM2M({
        organizationId: mockProducerDelegateId,
      })
    );

    expect(events1).toEqual(expectedEvents);
    expect(events2).toEqual(expectedEvents);
    expect(events1.length).toEqual(eventsWithDelegationIdCount);
  });

  it("should return an empty list if requester has no access to delegation set in filter", async () => {
    const events = await m2mEventService.getEServiceM2MEvents(
      undefined,
      10,
      mockProducerDelegationId,
      getMockContextM2M({
        organizationId: generateId<TenantId>(),
      })
    );

    expect(events).toEqual([]);
  });

  it("should exclude events accessible only as delegate if delegationId filter is set to null", async () => {
    const delegateExpectedEvents = mockEServiceM2MEvents.filter(
      (e) =>
        e.visibility === m2mEventVisibility.public ||
        (e.visibility === m2mEventVisibility.owner &&
          e.producerId === mockProducerDelegateId)
    );

    const delegateEvents = await m2mEventService.getEServiceM2MEvents(
      undefined,
      delegateExpectedEvents.length,
      null,
      getMockContextM2M({
        organizationId: mockProducerDelegateId,
      })
    );

    expect(delegateEvents).toEqual(delegateExpectedEvents);
    expect(delegateEvents.length).toEqual(
      eventsVisibleToProducerDelegate - eventsWithDelegationIdCount
    );
  });
});
