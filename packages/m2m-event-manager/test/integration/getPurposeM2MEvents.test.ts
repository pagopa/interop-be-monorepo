import { beforeEach, describe, expect, it } from "vitest";
import {
  getMockContextM2M,
  randomArrayItem,
} from "pagopa-interop-commons-test";
import {
  PurposeM2MEventType,
  DelegationId,
  TenantId,
  generateId,
  m2mEventVisibility,
} from "pagopa-interop-models";
import { getMockedPurposeM2MEvent } from "../mockUtils.js";
import { m2mEventService, writePurposeM2MEvent } from "../integrationUtils.js";

describe("getPurposeM2MEvents", () => {
  const mockProducerId: TenantId = generateId();
  const mockConsumerId: TenantId = generateId();
  const mockConsumerDelegateId: TenantId = generateId();
  const mockConsumerDelegationId: DelegationId = generateId();
  const mockProducerDelegateId: TenantId = generateId();
  const mockProducerDelegationId: DelegationId = generateId();

  const mockPurposeM2MEvents = PurposeM2MEventType.options
    .map((eventType) => [
      getMockedPurposeM2MEvent({
        eventType,
        visibility: m2mEventVisibility.owner,
        consumerId: mockConsumerId,
        producerId: mockProducerId,
        // Visible only to mockConsumerId
      }),
      getMockedPurposeM2MEvent({
        eventType,
        visibility: m2mEventVisibility.owner,
        consumerId: mockConsumerId,
        producerId: mockProducerId,
        consumerDelegateId: mockConsumerDelegateId,
        consumerDelegationId: mockConsumerDelegationId,
        // Visible only to mockConsumerId and mockConsumerDelegateId
      }),
      getMockedPurposeM2MEvent({
        eventType,
        visibility: m2mEventVisibility.restricted,
        consumerId: mockConsumerId,
        consumerDelegateId: mockConsumerDelegateId,
        consumerDelegationId: mockConsumerDelegationId,
        producerId: mockProducerId,
        // Visible only to mockConsumerId, mockProducerId, mockConsumerDelegateId
      }),
      getMockedPurposeM2MEvent({
        eventType,
        visibility: m2mEventVisibility.restricted,
        consumerId: mockConsumerId,
        producerId: mockProducerId,
        consumerDelegateId: mockConsumerDelegateId,
        consumerDelegationId: mockConsumerDelegationId,
        producerDelegateId: mockProducerDelegateId,
        producerDelegationId: mockProducerDelegationId,
        // Visible only to mockConsumerId, mockProducerId, mockConsumerDelegateId, mockProducerDelegateId
      }),
      getMockedPurposeM2MEvent({
        eventType,
        visibility: m2mEventVisibility.restricted,
        consumerId: mockConsumerDelegateId,
        producerId: mockProducerDelegateId,
        // Visible only to mockConsumerDelegateId, mockProducerDelegateId but not because of delegation
      }),
      getMockedPurposeM2MEvent({
        eventType,
        visibility: m2mEventVisibility.owner,
        producerId: mockProducerDelegateId,
        // Visible only to some other producer
      }),
      getMockedPurposeM2MEvent({
        eventType,
        visibility: randomArrayItem([
          m2mEventVisibility.restricted,
          m2mEventVisibility.owner,
        ]),
        // Visible only to some other producer
      }),
    ])
    .flat();

  const eventsVisibleToConsumer = PurposeM2MEventType.options.length * 4;
  const eventsVisibleToConsumerDelegate =
    PurposeM2MEventType.options.length * 4;
  const eventsVisibleToProducer = PurposeM2MEventType.options.length * 2;
  const eventsVisibleToProducerDelegate =
    PurposeM2MEventType.options.length * 2;
  const eventsWithConsumerDelegationIdCount =
    PurposeM2MEventType.options.length * 3;
  const eventsWithProducerDelegationIdCount =
    PurposeM2MEventType.options.length;
  beforeEach(async () => {
    await Promise.all(mockPurposeM2MEvents.map(writePurposeM2MEvent));
  });

  it("should list owner & restricted purpose M2M events (requester = consumer)", async () => {
    const expectedEvents = mockPurposeM2MEvents.filter(
      (e) => e.consumerId === mockConsumerId
    );

    const events = await m2mEventService.getPurposeM2MEvents(
      undefined,
      expectedEvents.length,
      undefined,
      getMockContextM2M({
        organizationId: mockConsumerId,
      })
    );
    expect(events).toEqual(expectedEvents);
    expect(events.length).toEqual(eventsVisibleToConsumer);
  });

  it("should list owner & restricted purpose M2M events (requester = consumerDelegate)", async () => {
    const expectedEvents = mockPurposeM2MEvents.filter(
      (e) =>
        e.consumerDelegateId === mockConsumerDelegateId ||
        e.consumerId === mockConsumerDelegateId
    );

    const events = await m2mEventService.getPurposeM2MEvents(
      undefined,
      expectedEvents.length,
      undefined,
      getMockContextM2M({
        organizationId: mockConsumerDelegateId,
      })
    );
    expect(events).toEqual(expectedEvents);
    expect(events.length).toEqual(eventsVisibleToConsumerDelegate);
  });

  it("should list only restricted purpose M2M events (requester = producer)", async () => {
    const expectedEvents = mockPurposeM2MEvents.filter(
      (e) =>
        e.producerId === mockProducerId &&
        e.visibility === m2mEventVisibility.restricted
    );

    const events = await m2mEventService.getPurposeM2MEvents(
      undefined,
      expectedEvents.length,
      undefined,
      getMockContextM2M({
        organizationId: mockProducerId,
      })
    );
    expect(events).toEqual(expectedEvents);
    expect(events.length).toEqual(eventsVisibleToProducer);
  });

  it("should list only restricted purpose M2M events (requester = producerDelegate)", async () => {
    const expectedEvents = mockPurposeM2MEvents.filter(
      (e) =>
        e.visibility === m2mEventVisibility.restricted &&
        (e.producerDelegateId === mockProducerDelegateId ||
          e.producerId === mockProducerDelegateId)
    );

    const events = await m2mEventService.getPurposeM2MEvents(
      undefined,
      expectedEvents.length,
      undefined,
      getMockContextM2M({
        organizationId: mockProducerDelegateId,
      })
    );
    expect(events).toEqual(expectedEvents);
    expect(events.length).toEqual(eventsVisibleToProducerDelegate);
  });

  it.each([1, 3, 10])(
    "should list the %d oldest purpose M2M events if lastEventId is not provided",
    async (limit) => {
      const events = await m2mEventService.getPurposeM2MEvents(
        undefined,
        limit,
        undefined,
        getMockContextM2M({
          organizationId: mockConsumerId,
        })
      );
      expect(events).toEqual(
        mockPurposeM2MEvents
          .filter((e) => e.consumerId === mockConsumerId)
          .slice(0, limit) // get the first N events
      );
    }
  );

  it.each([1, 3, 10])(
    "should list the %d oldest purpose M2M events after the given lastEventId",
    async (limit) => {
      const lastEventId = mockPurposeM2MEvents[limit].id;
      const events = await m2mEventService.getPurposeM2MEvents(
        lastEventId,
        limit,
        undefined,
        getMockContextM2M({
          organizationId: mockConsumerId,
        })
      );

      const filteredEvents = mockPurposeM2MEvents
        .filter((e) => e.consumerId === mockConsumerId)
        .filter((e) => e.id > lastEventId);

      expect(events).toEqual(
        filteredEvents.slice(0, limit) // get the first N events after the lastEventId
      );
    }
  );

  it("should apply delegationId filter (requester = consumer / consumerDelegate)", async () => {
    const expectedEvents = mockPurposeM2MEvents.filter(
      (e) => e.consumerDelegationId === mockConsumerDelegationId
    );

    const events1 = await m2mEventService.getPurposeM2MEvents(
      undefined,
      expectedEvents.length,
      mockConsumerDelegationId,
      getMockContextM2M({
        organizationId: mockConsumerId,
      })
    );

    const events2 = await m2mEventService.getPurposeM2MEvents(
      undefined,
      expectedEvents.length,
      mockConsumerDelegationId,
      getMockContextM2M({
        organizationId: mockConsumerDelegateId,
      })
    );

    expect(events1).toEqual(expectedEvents);
    expect(events2).toEqual(expectedEvents);
    expect(events1.length).toEqual(eventsWithConsumerDelegationIdCount);
  });

  it("should apply delegationId filter (requester = producer / producerDelegate)", async () => {
    const expectedEvents = mockPurposeM2MEvents.filter(
      (e) => e.producerDelegationId === mockProducerDelegationId
    );

    const events1 = await m2mEventService.getPurposeM2MEvents(
      undefined,
      expectedEvents.length,
      mockProducerDelegationId,
      getMockContextM2M({
        organizationId: mockProducerId,
      })
    );

    const events2 = await m2mEventService.getPurposeM2MEvents(
      undefined,
      expectedEvents.length,
      mockProducerDelegationId,
      getMockContextM2M({
        organizationId: mockProducerDelegateId,
      })
    );

    expect(events1).toEqual(expectedEvents);
    expect(events2).toEqual(expectedEvents);
    expect(events1.length).toEqual(eventsWithProducerDelegationIdCount);
  });

  it("should return an empty list if requester has no access to delegation set in filter", async () => {
    const events1 = await m2mEventService.getEServiceM2MEvents(
      undefined,
      10,
      mockProducerDelegationId,
      getMockContextM2M({
        organizationId: generateId<TenantId>(),
      })
    );

    const events2 = await m2mEventService.getEServiceM2MEvents(
      undefined,
      10,
      mockConsumerDelegationId,
      getMockContextM2M({
        organizationId: generateId<TenantId>(),
      })
    );

    expect(events1).toEqual([]);
    expect(events2).toEqual([]);
  });

  it("should exclude events accessible only as delegate if delegationId filter is set to null (requester = producerDelegate)", async () => {
    const delegateExpectedEvents = mockPurposeM2MEvents.filter(
      (e) =>
        e.visibility === m2mEventVisibility.restricted &&
        e.producerId === mockProducerDelegateId
    );

    const delegateEvents = await m2mEventService.getPurposeM2MEvents(
      undefined,
      delegateExpectedEvents.length,
      null,
      getMockContextM2M({
        organizationId: mockProducerDelegateId,
      })
    );

    expect(delegateEvents).toEqual(delegateExpectedEvents);
    expect(delegateEvents.length).toEqual(
      eventsVisibleToProducerDelegate - eventsWithProducerDelegationIdCount
    );
  });

  it("should exclude events accessible only as delegate if delegationId filter is set to null (requester = consumerDelegate)", async () => {
    const delegateExpectedEvents = mockPurposeM2MEvents.filter(
      (e) => e.consumerId === mockConsumerDelegateId
    );

    const delegateEvents = await m2mEventService.getPurposeM2MEvents(
      undefined,
      delegateExpectedEvents.length,
      null,
      getMockContextM2M({
        organizationId: mockConsumerDelegateId,
      })
    );

    expect(delegateEvents).toEqual(delegateExpectedEvents);
    expect(delegateEvents.length).toEqual(
      eventsVisibleToConsumerDelegate - eventsWithConsumerDelegationIdCount
    );
  });
});
