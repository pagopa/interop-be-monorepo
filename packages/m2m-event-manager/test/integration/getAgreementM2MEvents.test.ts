import { beforeEach, describe, expect, it } from "vitest";
import {
  getMockContextM2M,
  randomArrayItem,
} from "pagopa-interop-commons-test";
import {
  AgreementM2MEventType,
  TenantId,
  generateId,
  m2mEventVisibility,
} from "pagopa-interop-models";
import { getMockedAgreementM2MEvent } from "../mockUtils.js";
import {
  m2mEventService,
  writeAgreementM2MEvent,
} from "../integrationUtils.js";

describe("getAgreementM2MEvents", () => {
  const mockProducerId: TenantId = generateId();
  const mockConsumerId: TenantId = generateId();
  const mockConsumerDelegateId: TenantId = generateId();
  const mockProducerDelegateId: TenantId = generateId();

  const mockAgreementM2MEvents = AgreementM2MEventType.options
    .map((eventType) => [
      getMockedAgreementM2MEvent({
        eventType,
        visibility: m2mEventVisibility.owner,
        consumerId: mockConsumerId,
        producerId: mockProducerId,
        producerDelegateId: mockProducerDelegateId,
        // Visible only to mockConsumerId
      }),
      getMockedAgreementM2MEvent({
        eventType,
        visibility: m2mEventVisibility.owner,
        consumerId: mockConsumerId,
        consumerDelegateId: mockConsumerDelegateId,
        producerId: mockProducerId,
        producerDelegateId: mockProducerDelegateId,
        // Visible only to mockConsumerId and mockConsumerDelegateId
      }),
      getMockedAgreementM2MEvent({
        eventType,
        visibility: m2mEventVisibility.restricted,
        consumerId: mockConsumerId,
        consumerDelegateId: mockConsumerDelegateId,
        producerId: mockProducerId,
        // Visible only to mockConsumerId, mockProducerId, mockConsumerDelegateId
      }),
      getMockedAgreementM2MEvent({
        eventType,
        visibility: m2mEventVisibility.restricted,
        consumerId: mockConsumerId,
        consumerDelegateId: mockConsumerDelegateId,
        producerId: mockProducerId,
        producerDelegateId: mockProducerDelegateId,
        // Visible only to mockConsumerId, mockProducerId, mockConsumerDelegateId, mockProducerDelegateId
      }),
      getMockedAgreementM2MEvent({
        eventType,
        visibility: randomArrayItem([
          m2mEventVisibility.restricted,
          m2mEventVisibility.owner,
        ]),
        // Visible only to some other producer
      }),
    ])
    .flat();

  const eventsVisibleToConsumer = AgreementM2MEventType.options.length * 4;
  const eventsVisibleToConsumerDelegate =
    AgreementM2MEventType.options.length * 3;
  const eventsVisibleToProducer = AgreementM2MEventType.options.length * 2;
  const eventsVisibleToProducerDelegate = AgreementM2MEventType.options.length;

  beforeEach(async () => {
    await Promise.all(mockAgreementM2MEvents.map(writeAgreementM2MEvent));
  });

  it("should list owner & restricted agreement M2M events (requester = consumerId)", async () => {
    const expectedEvents = mockAgreementM2MEvents.filter(
      (e) => e.consumerId === mockConsumerId
    );

    const events = await m2mEventService.getAgreementM2MEvents(
      undefined,
      expectedEvents.length,
      getMockContextM2M({
        organizationId: mockConsumerId,
      })
    );
    expect(events).toEqual(expectedEvents);
    expect(events.length).toEqual(eventsVisibleToConsumer);
  });

  it("should list owner & restricted agreement M2M events (requester = consumerDelegateId)", async () => {
    const expectedEvents = mockAgreementM2MEvents.filter(
      (e) => e.consumerDelegateId === mockConsumerDelegateId
    );

    const events = await m2mEventService.getAgreementM2MEvents(
      undefined,
      expectedEvents.length,
      getMockContextM2M({
        organizationId: mockConsumerDelegateId,
      })
    );
    expect(events).toEqual(expectedEvents);
    expect(events.length).toEqual(eventsVisibleToConsumerDelegate);
  });

  it("should list only restricted agreement M2M events (requester = producerId)", async () => {
    const expectedEvents = mockAgreementM2MEvents.filter(
      (e) =>
        e.producerId === mockProducerId &&
        e.visibility === m2mEventVisibility.restricted
    );

    const events = await m2mEventService.getAgreementM2MEvents(
      undefined,
      expectedEvents.length,
      getMockContextM2M({
        organizationId: mockProducerId,
      })
    );
    expect(events).toEqual(expectedEvents);
    expect(events.length).toEqual(eventsVisibleToProducer);
  });

  it("should list only restricted agreement M2M events (requester = producerDelegateId)", async () => {
    const expectedEvents = mockAgreementM2MEvents.filter(
      (e) =>
        e.producerDelegateId === mockProducerDelegateId &&
        e.visibility === m2mEventVisibility.restricted
    );

    const events = await m2mEventService.getAgreementM2MEvents(
      undefined,
      expectedEvents.length,
      getMockContextM2M({
        organizationId: mockProducerDelegateId,
      })
    );
    expect(events).toEqual(expectedEvents);
    expect(events.length).toEqual(eventsVisibleToProducerDelegate);
  });

  it.each([1, 3, 10])(
    "should list the %d oldest agreement M2M events if lastEventId is not provided",
    async (limit) => {
      const events = await m2mEventService.getAgreementM2MEvents(
        undefined,
        limit,
        getMockContextM2M({
          organizationId: mockConsumerId,
        })
      );
      expect(events).toEqual(
        mockAgreementM2MEvents
          .filter((e) => e.consumerId === mockConsumerId)
          .slice(0, limit) // get the first N events
      );
    }
  );

  it.each([1, 3, 10])(
    "should list the %d oldest agreement M2M events after the given lastEventId",
    async (limit) => {
      const lastEventId = mockAgreementM2MEvents[limit].id;
      const events = await m2mEventService.getAgreementM2MEvents(
        lastEventId,
        limit,
        getMockContextM2M({
          organizationId: mockConsumerId,
        })
      );

      const filteredEvents = mockAgreementM2MEvents
        .filter((e) => e.consumerId === mockConsumerId)
        .filter((e) => e.id > lastEventId);

      expect(events).toEqual(
        filteredEvents.slice(0, limit) // get the first N events after the lastEventId
      );
    }
  );
});
