import { beforeEach, describe, expect, it, vi } from "vitest";
import { getMockAttribute } from "pagopa-interop-commons-test";
import {
  AttributeEventEnvelope,
  toAttributeV1,
  AttributeEvent,
} from "pagopa-interop-models";
import { genericLogger } from "pagopa-interop-commons";
import { match } from "ts-pattern";
import { handleAttributeEvent } from "../src/handlers/handleAttributeEvent.js";
import {
  getMockEventEnvelopeCommons,
  retrieveLastAttributeM2MEvent,
  testM2mEventWriterService,
} from "./utils.js";

describe("handleAttributeEvent test", async () => {
  const attribute = getMockAttribute();
  vi.spyOn(testM2mEventWriterService, "insertAttributeM2MEvent");

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(AttributeEvent.options.map((o) => o.shape.type.value))(
    "should write %s M2M event with the right visibility",
    async (eventType: AttributeEvent["type"]) => {
      const message = {
        ...getMockEventEnvelopeCommons(),
        stream_id: attribute.id,
        type: eventType,
        data: {
          attribute: toAttributeV1(attribute),
        },
      } as AttributeEventEnvelope;

      const eventTimestamp = new Date();

      const expectedM2MEvent = await match(eventType)
        .with("AttributeAdded", async () => ({
          id: expect.any(String),
          eventType,
          eventTimestamp,
          attributeId: attribute.id,
        }))
        .with("MaintenanceAttributeDeleted", () => undefined)
        .exhaustive();

      await handleAttributeEvent(
        message,
        eventTimestamp,
        genericLogger,
        testM2mEventWriterService
      );

      if (!expectedM2MEvent) {
        expect(
          testM2mEventWriterService.insertAttributeM2MEvent
        ).not.toHaveBeenCalled();
      } else {
        expect(
          testM2mEventWriterService.insertAttributeM2MEvent
        ).toHaveBeenCalledTimes(1);
        const actualM2MEvent = await retrieveLastAttributeM2MEvent();
        expect(actualM2MEvent).toEqual(expectedM2MEvent);
      }
    }
  );
});
