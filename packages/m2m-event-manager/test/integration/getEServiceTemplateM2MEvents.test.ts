import { beforeEach, describe, expect, it } from "vitest";
import { getMockContextM2M } from "pagopa-interop-commons-test";
import {
  EServiceTemplateM2MEventType,
  TenantId,
  generateId,
  m2mEventVisibility,
} from "pagopa-interop-models";
import { getMockedEServiceTemplateM2MEvent } from "../mockUtils.js";
import {
  m2mEventService,
  writeEServiceTemplateM2MEvent,
} from "../integrationUtils.js";

describe("getEServiceTemplateM2MEvents", () => {
  const mockCreatorId: TenantId = generateId();

  const mockEServiceTemplateM2MEvents = EServiceTemplateM2MEventType.options
    .map((eventType) => [
      getMockedEServiceTemplateM2MEvent({
        eventType,
        visibility: m2mEventVisibility.public,
      }),
      getMockedEServiceTemplateM2MEvent({
        eventType,
        visibility: m2mEventVisibility.owner,
        creatorId: mockCreatorId,
        // Visible only to mockCreator
      }),
      getMockedEServiceTemplateM2MEvent({
        eventType,
        visibility: m2mEventVisibility.owner,
        // Visible only to some other creator
      }),
    ])
    .flat();

  const publicEventsCount = EServiceTemplateM2MEventType.options.length;
  const eventsVisibleToCreator =
    EServiceTemplateM2MEventType.options.length * 3; // public + owned by creator

  beforeEach(async () => {
    await Promise.all(
      mockEServiceTemplateM2MEvents.map(writeEServiceTemplateM2MEvent)
    );
  });

  it("should list only public eserviceTemplate M2M events", async () => {
    const publicEvents = mockEServiceTemplateM2MEvents.filter(
      (e) => e.visibility === m2mEventVisibility.public
    );

    const events = await m2mEventService.getEServiceTemplateM2MEvents(
      undefined,
      publicEvents.length,
      getMockContextM2M({})
    );
    expect(events).toEqual(publicEvents);
    expect(events.length).toEqual(publicEventsCount);
  });

  it("should list public & owner eserviceTemplate M2M events (requester = creator)", async () => {
    const ownerEvents = mockEServiceTemplateM2MEvents.filter(
      (e) =>
        e.visibility === m2mEventVisibility.public ||
        (e.visibility === m2mEventVisibility.owner &&
          e.creatorId === mockCreatorId)
    );

    const events = await m2mEventService.getEServiceTemplateM2MEvents(
      undefined,
      ownerEvents.length,
      getMockContextM2M({
        organizationId: mockCreatorId,
      })
    );
    expect(events).toEqual(ownerEvents);
    expect(events.length).toEqual(eventsVisibleToCreator);
  });

  it.each([1, 3, 10])(
    "should list the %d oldest eserviceTemplate M2M events if lastEventId is not provided",
    async (limit) => {
      const events = await m2mEventService.getEServiceTemplateM2MEvents(
        undefined,
        limit,
        getMockContextM2M({})
      );
      expect(events).toEqual(
        mockEServiceTemplateM2MEvents
          .filter((e) => e.visibility === m2mEventVisibility.public)
          .slice(0, limit) // get the first N events
      );
    }
  );

  it.each([1, 3, 10])(
    "should list the %d oldest eserviceTemplate M2M events after the given lastEventId",
    async (limit) => {
      const lastEventId = mockEServiceTemplateM2MEvents[limit].id;
      const events = await m2mEventService.getEServiceTemplateM2MEvents(
        lastEventId,
        limit,
        getMockContextM2M({})
      );

      const filteredEvents = mockEServiceTemplateM2MEvents
        .filter((e) => e.visibility === m2mEventVisibility.public)
        .filter((e) => e.id > lastEventId);

      expect(events).toEqual(
        filteredEvents.slice(0, limit) // get the first N events after the lastEventId
      );
    }
  );
});
