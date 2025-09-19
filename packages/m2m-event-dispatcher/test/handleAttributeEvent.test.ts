/* eslint-disable functional/no-let */
/* eslint-disable functional/immutable-data */
/* eslint-disable @typescript-eslint/no-unused-vars */

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

  it.each(
    AttributeEvent.options.map((o) => ({
      ...getMockEventEnvelopeCommons(),
      stream_id: attribute.id,
      type: o.shape.type.value,
      data: {
        attribute: toAttributeV1(attribute),
      },
    })) as AttributeEventEnvelope[]
  )(
    "should write M2M event for AttributeAdded event",
    async (message: AttributeEventEnvelope) => {
      const eventTimestamp = new Date();

      await handleAttributeEvent(
        message,
        eventTimestamp,
        genericLogger,
        testM2mEventWriterService
      );

      await match(message)
        .with({ type: "AttributeAdded" }, async (m) => {
          expect(
            testM2mEventWriterService.insertAttributeM2MEvent
          ).toHaveBeenCalledTimes(1);
          const attributeM2MEvent = await retrieveLastAttributeM2MEvent();
          expect(attributeM2MEvent).toEqual({
            id: expect.any(String),
            eventType: m.type,
            eventTimestamp,
            attributeId: attribute.id,
          });
        })
        .with({ type: "MaintenanceAttributeDeleted" }, () => {
          expect(
            testM2mEventWriterService.insertAttributeM2MEvent
          ).toHaveBeenCalledTimes(0);
        })
        .exhaustive();
    }
  );
});
