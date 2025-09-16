/* eslint-disable functional/no-let */
/* eslint-disable functional/immutable-data */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { describe, expect, it } from "vitest";
import { getMockAttribute } from "pagopa-interop-commons-test";
import {
  AttributeAddedV1,
  AttributeEventEnvelope,
  MaintenanceAttributeDeletedV1,
  toAttributeV1,
} from "pagopa-interop-models";
import { genericLogger } from "pagopa-interop-commons";
import { P, match } from "ts-pattern";
import { handleAttributeEvent } from "../src/handlers/handleAttributeEvent.js";
import {
  getMockEventEnvelopeCommons,
  retrieveLastAttributeM2MEvent,
  testM2mEventWriterService,
} from "./utils.js";

describe("handleAgreementEvent test", async () => {
  const attribute = getMockAttribute();
  it.each([
    {
      ...getMockEventEnvelopeCommons(),
      stream_id: attribute.id,
      type: "AttributeAdded",
      data: { attribute: toAttributeV1(attribute) } satisfies AttributeAddedV1,
    },
    {
      ...getMockEventEnvelopeCommons(),
      stream_id: attribute.id,
      type: "MaintenanceAttributeDeleted",
      data: { id: attribute.id } satisfies MaintenanceAttributeDeletedV1,
    },
  ] as AttributeEventEnvelope[])(
    "should write M2M event for AttributeAdded event",
    async (message: AttributeEventEnvelope) => {
      const eventTimestamp = new Date();

      await handleAttributeEvent(
        message,
        eventTimestamp,
        genericLogger,
        testM2mEventWriterService
      );

      const attributeM2MEvent = await retrieveLastAttributeM2MEvent();
      expect(attributeM2MEvent).toEqual(
        match(message)
          .with(
            {
              type: P.union("AttributeAdded", "MaintenanceAttributeDeleted"),
            },
            (m) => ({
              id: expect.any(String),
              eventType: m.type,
              eventTimestamp,
              attributeId: attribute.id,
            })
          )
          .exhaustive()
      );
    }
  );
});
