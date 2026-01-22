import { describe, expect, it, vi } from "vitest";
import {
  getMockPurposeTemplate, // Assumi esistano i mock necessari
} from "pagopa-interop-commons-test";
import {
  PurposeTemplateEventV2,
  m2mEventVisibility,
  generateId,
  purposeTemplateState,
  PurposeTemplateEventEnvelopeV2,
  toPurposeTemplateV2,
  TenantId,
} from "pagopa-interop-models";
import { genericLogger } from "pagopa-interop-commons";
import { P, match } from "ts-pattern";
import {
  getMockEventEnvelopeCommons,
  retrieveLastPurposeTemplateM2MEvent,
  testM2mEventWriterService,
} from "./utils.js";
import { handlePurposeTemplateEvent } from "../src/handlers/handlePurposeTemplateEvent.js";

describe("handlePurposeTemplateEvent test", async () => {
  vi.spyOn(testM2mEventWriterService, "insertPurposeTemplateM2MEvent");

  describe.each(PurposeTemplateEventV2.options.map((o) => o.shape.type.value))(
    "with %s event",
    (eventType: PurposeTemplateEventV2["type"]) =>
      it("should write M2M events with the right visibility according to specification", async () => {
        const creatorId = generateId<TenantId>();
        const eventTimestamp = new Date();
        const testCasesData = await match(eventType)
          .with(
            P.union(
              "PurposeTemplateAdded",
              "PurposeTemplateDraftUpdated",
              "PurposeTemplateAnnotationDocumentAdded",
              "PurposeTemplateAnnotationDocumentUpdated",
              "PurposeTemplateAnnotationDocumentDeleted",
              "PurposeTemplateDraftDeleted"
            ),
            async () => [
              {
                state: purposeTemplateState.draft,
                expectedVisibility: m2mEventVisibility.owner,
              },
            ]
          )
          .with(
            P.union(
              "PurposeTemplatePublished",
              "PurposeTemplateSuspended",
              "PurposeTemplateUnsuspended",
              "PurposeTemplateArchived",
              "RiskAnalysisTemplateSignedDocumentGenerated"
            ),
            async () => [
              {
                state: purposeTemplateState.published,
                expectedVisibility: m2mEventVisibility.public,
              },
            ]
          )
          .with(
            P.union(
              "PurposeTemplateEServiceLinked",
              "PurposeTemplateEServiceUnlinked"
            ),
            async () => [
              {
                state: purposeTemplateState.published,
                expectedVisibility: m2mEventVisibility.public,
              },
              {
                state: purposeTemplateState.draft,
                expectedVisibility: m2mEventVisibility.owner,
              },
              {
                state: purposeTemplateState.suspended,
                expectedVisibility: m2mEventVisibility.owner,
              }
            ]
          )
          .with("RiskAnalysisTemplateDocumentGenerated", async () => [])
          .exhaustive();

        for (const { state, expectedVisibility } of testCasesData) {
          const purposeTemplate = getMockPurposeTemplate(creatorId, state);

          const message = {
            ...getMockEventEnvelopeCommons(),
            stream_id: purposeTemplate.id,
            type: eventType,
            data: {
              purposeTemplate: toPurposeTemplateV2(purposeTemplate),
              eserviceId: eventType.includes("Linked") ? generateId() : undefined,
              descriptorId: eventType.includes("Linked") ? generateId() : undefined,
            },
          } as PurposeTemplateEventEnvelopeV2;

          await handlePurposeTemplateEvent(
            message,
            eventTimestamp,
            genericLogger,
            testM2mEventWriterService
          );

          expect(
            testM2mEventWriterService.insertPurposeTemplateM2MEvent
          ).toHaveBeenCalledTimes(1);

          const actualM2MEvent = await retrieveLastPurposeTemplateM2MEvent();
          expect(actualM2MEvent.visibility).toBe(expectedVisibility);

          vi.clearAllMocks();
        }
      })
  );
});
