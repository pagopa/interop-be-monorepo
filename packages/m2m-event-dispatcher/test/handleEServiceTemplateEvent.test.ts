import { describe, expect, it, vi } from "vitest";
import {
  getMockEServiceTemplate,
  getMockEServiceTemplateVersion,
  randomArrayItem,
} from "pagopa-interop-commons-test";
import {
  EServiceTemplateEventV2,
  m2mEventVisibility,
  generateId,
  TenantId,
  eserviceTemplateVersionState,
  EServiceTemplateId,
  EServiceTemplateEventEnvelopeV2,
  toEServiceTemplateV2,
} from "pagopa-interop-models";
import { genericLogger } from "pagopa-interop-commons";
import { P, match } from "ts-pattern";
import { handleEServiceTemplateEvent } from "../src/handlers/handleEServiceTemplateEvent.js";
import {
  getMockEventEnvelopeCommons,
  retrieveLastEServiceTemplateM2MEvent,
  retrieveAllEServiceTemplateM2MEvents,
  testM2mEventWriterService,
} from "./utils.js";

describe("handleEServiceTemplateEvent test", async () => {
  vi.spyOn(testM2mEventWriterService, "insertEServiceTemplateM2MEvent");

  describe.each(EServiceTemplateEventV2.options.map((o) => o.shape.type.value))(
    "with %s event",
    (eventType: EServiceTemplateEventV2["type"]) =>
      it("should write M2M events with the right visibility", async () => {
        const eserviceTemplateId = generateId<EServiceTemplateId>();
        const creatorId = generateId<TenantId>();
        const eventTimestamp = new Date();

        const testCasesData = await match(eventType)
          .with(
            P.union(
              // Draft E-Service Template events, owner visibility
              "EServiceTemplateAdded",
              "EServiceTemplateDraftUpdated",
              "EServiceTemplateDeleted",
              "EServiceTemplateRiskAnalysisAdded",
              "EServiceTemplateRiskAnalysisUpdated",
              "EServiceTemplateRiskAnalysisDeleted"
            ),
            async () => [
              {
                versions: [
                  getMockEServiceTemplateVersion(
                    undefined,
                    randomArrayItem(Object.values(eserviceTemplateVersionState))
                  ),
                  getMockEServiceTemplateVersion(
                    undefined,
                    randomArrayItem(Object.values(eserviceTemplateVersionState))
                  ),
                  // Visibility based only on event, versions state doesn't matter
                ],
                affectedVersion: undefined,
                expectedVisibility: m2mEventVisibility.owner,
              },
            ]
          )
          .with(
            P.union(
              // Draft E-Service Template version events, owner visibility
              "EServiceTemplateVersionAdded",
              "EServiceTemplateDraftVersionUpdated",
              "EServiceTemplateDraftVersionDeleted",
              "EServiceTemplateVersionInterfaceAdded",
              "EServiceTemplateVersionInterfaceDeleted",
              "EServiceTemplateVersionInterfaceUpdated"
            ),
            async () => [
              {
                versions: [
                  getMockEServiceTemplateVersion(
                    undefined,
                    randomArrayItem(Object.values(eserviceTemplateVersionState))
                  ),
                  getMockEServiceTemplateVersion(
                    undefined,
                    randomArrayItem(Object.values(eserviceTemplateVersionState))
                  ),
                  // Visibility based only on event, versions state doesn't matter
                ],
                affectedVersion: 1,
                expectedVisibility: m2mEventVisibility.owner,
              },
            ]
          )
          .with(
            P.union(
              // E-Service Template events after publication, public visibility
              "EServiceTemplateIntendedTargetUpdated",
              "EServiceTemplateDescriptionUpdated",
              "EServiceTemplateNameUpdated"
            ),
            async () => [
              {
                versions: [
                  getMockEServiceTemplateVersion(
                    undefined,
                    randomArrayItem(Object.values(eserviceTemplateVersionState))
                  ),
                  getMockEServiceTemplateVersion(
                    undefined,
                    randomArrayItem(Object.values(eserviceTemplateVersionState))
                  ),
                  // Visibility based only on event, versions state doesn't matter
                ],
                affectedVersion: undefined,
                expectedVisibility: m2mEventVisibility.public,
              },
            ]
          )
          .with(
            P.union(
              // E-Service Descriptor events after publication, public visibility
              "EServiceTemplateVersionActivated",
              "EServiceTemplateVersionSuspended",
              "EServiceTemplateVersionAttributesUpdated",
              "EServiceTemplateVersionPublished",
              "EServiceTemplateVersionQuotasUpdated",
              "EServiceTemplatePersonalDataFlagUpdatedAfterPublication"
            ),
            async () => [
              {
                versions: [
                  getMockEServiceTemplateVersion(
                    undefined,
                    randomArrayItem(Object.values(eserviceTemplateVersionState))
                  ),
                  getMockEServiceTemplateVersion(
                    undefined,
                    randomArrayItem(Object.values(eserviceTemplateVersionState))
                  ),
                  // Visibility based only on event, versions state doesn't matter
                ],
                affectedVersion: 1,
                expectedVisibility: m2mEventVisibility.public,
              },
            ]
          )
          .with(
            P.union(
              // E-Service Template version events both for Draft and Published E-Service Templates,
              // visibility depends on the state
              "EServiceTemplateVersionDocumentAdded",
              "EServiceTemplateVersionDocumentDeleted",
              "EServiceTemplateVersionDocumentUpdated"
            ),
            async () => [
              {
                // Affected version is published, public visibility
                versions: [
                  getMockEServiceTemplateVersion(
                    undefined,
                    eserviceTemplateVersionState.deprecated
                  ),
                  getMockEServiceTemplateVersion(
                    undefined,
                    eserviceTemplateVersionState.published
                  ),
                  getMockEServiceTemplateVersion(
                    undefined,
                    eserviceTemplateVersionState.draft
                  ),
                ],
                affectedVersion: 1,
                expectedVisibility: m2mEventVisibility.public,
              },
              // Affected versions is draft or waiting for approval, owner visibility
              {
                versions: [
                  getMockEServiceTemplateVersion(
                    undefined,
                    eserviceTemplateVersionState.published
                  ),
                  getMockEServiceTemplateVersion(
                    undefined,
                    eserviceTemplateVersionState.draft
                  ),
                ],
                affectedVersion: 1,
                expectedVisibility: m2mEventVisibility.owner,
              },
            ]
          )
          .exhaustive();

        for (const {
          versions,
          affectedVersion,
          expectedVisibility,
        } of testCasesData) {
          const eserviceTemplate = getMockEServiceTemplate(
            eserviceTemplateId,
            creatorId,
            versions
          );

          const versionId = affectedVersion
            ? eserviceTemplate.versions.at(affectedVersion)!.id
            : undefined;

          const message = {
            ...getMockEventEnvelopeCommons(),
            stream_id: eserviceTemplate.id,
            type: eventType,
            data: {
              eserviceTemplate: toEServiceTemplateV2(eserviceTemplate),
              eserviceTemplateVersionId: versionId,
            },
          } as EServiceTemplateEventEnvelopeV2;

          await handleEServiceTemplateEvent(
            message,
            eventTimestamp,
            genericLogger,
            testM2mEventWriterService
          );
          expect(
            testM2mEventWriterService.insertEServiceTemplateM2MEvent
          ).toHaveBeenCalledTimes(1);
          vi.clearAllMocks();

          const actualM2MEvent = await retrieveLastEServiceTemplateM2MEvent();
          expect(actualM2MEvent).toEqual({
            id: expect.any(String),
            eventType,
            eventTimestamp,
            resourceVersion: message.version,
            eserviceTemplateId: eserviceTemplate.id,
            versionId,
            creatorId: eserviceTemplate.creatorId,
            visibility: expectedVisibility,
          });
        }
      })
  );

  it("should not write the event if the same resource version is already present", async () => {
    const eserviceTemplate = getMockEServiceTemplate();

    const message = {
      ...getMockEventEnvelopeCommons(),
      stream_id: eserviceTemplate.id,
      type: "EServiceTemplateAdded",
      data: {
        eserviceTemplate: toEServiceTemplateV2(eserviceTemplate),
      },
    } as EServiceTemplateEventEnvelopeV2;

    const eventTimestamp = new Date();

    // Insert the event for the first time
    await handleEServiceTemplateEvent(
      message,
      eventTimestamp,
      genericLogger,
      testM2mEventWriterService
    );

    // Try to insert the same event again: should be skipped
    await handleEServiceTemplateEvent(
      message,
      eventTimestamp,
      genericLogger,
      testM2mEventWriterService
    );

    // Try to insert one with a further resource version: should be inserted
    await handleEServiceTemplateEvent(
      { ...message, version: message.version + 1 },
      eventTimestamp,
      genericLogger,
      testM2mEventWriterService
    );

    expect(
      testM2mEventWriterService.insertEServiceTemplateM2MEvent
    ).toHaveBeenCalledTimes(3);

    expect(await retrieveAllEServiceTemplateM2MEvents()).toHaveLength(2);
  });
});
