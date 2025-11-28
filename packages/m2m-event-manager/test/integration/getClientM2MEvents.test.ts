import { beforeEach, describe, expect, it } from "vitest";
import { getMockContextM2M } from "pagopa-interop-commons-test";
import {
  ClientM2MEventType,
  TenantId,
  generateId,
  m2mEventVisibility,
} from "pagopa-interop-models";
import { getMockedClientM2MEvent } from "../mockUtils.js";
import { m2mEventService, writeClientM2MEvent } from "../integrationUtils.js";

describe("getClientM2MEvents", () => {
  const mockConsumerId: TenantId = generateId();

  const mockClientM2MEvents = ClientM2MEventType.options
    .map((eventType) => [
      getMockedClientM2MEvent({
        eventType,
        visibility: m2mEventVisibility.public,
      }),
      getMockedClientM2MEvent({
        eventType,
        visibility: m2mEventVisibility.owner,
        consumerId: mockConsumerId,
        // Visible only to mockConsumer
      }),
      getMockedClientM2MEvent({
        eventType,
        visibility: m2mEventVisibility.owner,
        // Visible only to some other consumer
      }),
    ])
    .flat();

  const publicEventsCount = ClientM2MEventType.options.length;
  const eventsVisibleToConsumer = ClientM2MEventType.options.length * 2; // public + owned by consumer

  beforeEach(async () => {
    await Promise.all(mockClientM2MEvents.map(writeClientM2MEvent));
  });

  it("should list only public client M2M events", async () => {
    const publicEvents = mockClientM2MEvents.filter(
      (e) => e.visibility === m2mEventVisibility.public
    );

    const events = await m2mEventService.getClientM2MEvents(
      undefined,
      publicEvents.length,
      getMockContextM2M({})
    );
    expect(events).toEqual(publicEvents);
    expect(events.length).toEqual(publicEventsCount);
  });

  it("should list public & owner client M2M events (requester = consumer)", async () => {
    const ownerEvents = mockClientM2MEvents.filter(
      (e) =>
        e.visibility === m2mEventVisibility.public ||
        (e.visibility === m2mEventVisibility.owner &&
          e.consumerId === mockConsumerId)
    );

    const events = await m2mEventService.getClientM2MEvents(
      undefined,
      ownerEvents.length,
      getMockContextM2M({
        organizationId: mockConsumerId,
      })
    );
    expect(events).toEqual(ownerEvents);
    expect(events.length).toEqual(eventsVisibleToConsumer);
  });

  it.each([1, 3, 10])(
    "should list the %d oldest client M2M events if lastEventId is not provided",
    async (limit) => {
      const events = await m2mEventService.getClientM2MEvents(
        undefined,
        limit,
        getMockContextM2M({})
      );
      expect(events).toEqual(
        mockClientM2MEvents
          .filter((e) => e.visibility === m2mEventVisibility.public)
          .slice(0, limit) // get the first N events
      );
    }
  );

  it.each([1, 3, 10])(
    "should list the %d oldest client M2M events after the given lastEventId",
    async (limit) => {
      const lastEventId = mockClientM2MEvents[limit].id;
      const events = await m2mEventService.getClientM2MEvents(
        lastEventId,
        limit,
        getMockContextM2M({})
      );

      const filteredEvents = mockClientM2MEvents
        .filter((e) => e.visibility === m2mEventVisibility.public)
        .filter((e) => e.id > lastEventId);

      expect(events).toEqual(
        filteredEvents.slice(0, limit) // get the first N events after the lastEventId
      );
    }
  );
});
