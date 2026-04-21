import { beforeEach, describe, expect, it } from "vitest";
import { getMockContextM2M } from "pagopa-interop-commons-test";
import {
  ProducerKeyM2MEventType,
  TenantId,
  generateId,
  m2mEventVisibility,
} from "pagopa-interop-models";
import { getMockedProducerKeyM2MEvent } from "../mockUtils.js";
import {
  m2mEventService,
  writeProducerKeyM2MEvent,
} from "../integrationUtils.js";

describe("getProducerKeyM2MEvents", () => {
  const mockProducerId: TenantId = generateId();

  const mockProducerKeyM2MEvents = ProducerKeyM2MEventType.options
    .map((eventType) => [
      getMockedProducerKeyM2MEvent(eventType, {
        producerId: mockProducerId,
        visibility: m2mEventVisibility.owner,
      }),
      getMockedProducerKeyM2MEvent(eventType, {
        visibility: m2mEventVisibility.owner,
      }),
    ])
    .flat();

  beforeEach(async () => {
    await Promise.all(mockProducerKeyM2MEvents.map(writeProducerKeyM2MEvent));
  });

  it("should not list producer key M2M events for non-owners", async () => {
    const events = await m2mEventService.getProducerKeyM2MEvents(
      undefined,
      mockProducerKeyM2MEvents.length,
      getMockContextM2M({
        organizationId: generateId<TenantId>(),
      })
    );
    expect(events).toEqual([]);
  });

  it("should list only owner producer key M2M events", async () => {
    const ownerEvents = mockProducerKeyM2MEvents.filter(
      (event) => event.producerId === mockProducerId
    );

    const events = await m2mEventService.getProducerKeyM2MEvents(
      undefined,
      mockProducerKeyM2MEvents.length,
      getMockContextM2M({
        organizationId: mockProducerId,
      })
    );
    expect(events).toEqual(ownerEvents);
  });

  it.each([1, 3, 10])(
    "should list the %d oldest owned producer key M2M events if lastEventId is not provided",
    async (limit) => {
      const events = await m2mEventService.getProducerKeyM2MEvents(
        undefined,
        limit,
        getMockContextM2M({
          organizationId: mockProducerId,
        })
      );
      expect(events).toEqual(
        mockProducerKeyM2MEvents
          .filter((event) => event.producerId === mockProducerId)
          .slice(0, limit)
      );
    }
  );

  it.each([1, 3, 10])(
    "should list the %d oldest owned producer key M2M events after the given lastEventId",
    async (limit) => {
      const lastEventId = mockProducerKeyM2MEvents[2].id;
      const events = await m2mEventService.getProducerKeyM2MEvents(
        lastEventId,
        limit,
        getMockContextM2M({
          organizationId: mockProducerId,
        })
      );

      const filteredEvents = mockProducerKeyM2MEvents.filter(
        (event) => event.producerId === mockProducerId && event.id > lastEventId
      );
      expect(events).toEqual(
        filteredEvents.slice(0, limit)
      );
    }
  );
});
