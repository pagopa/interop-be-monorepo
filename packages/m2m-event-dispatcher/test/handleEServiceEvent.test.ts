import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getMockDelegation,
  getMockDescriptor,
  getMockEService,
  randomArrayItem,
} from "pagopa-interop-commons-test";
import {
  toEServiceV2,
  EServiceEventV2,
  EServiceEventEnvelopeV2,
  descriptorState,
  EServiceM2MEvent,
  m2mEventVisibility,
  EService,
  delegationKind,
  generateId,
  delegationState,
  TenantId,
} from "pagopa-interop-models";
import { genericLogger } from "pagopa-interop-commons";
import { P, match } from "ts-pattern";
import { handleEServiceEvent } from "../src/handlers/handleEServiceEvent.js";
import {
  addOneDelegationToReadModel,
  getMockEventEnvelopeCommons,
  retrieveLastEServiceM2MEvent,
  testM2mEventWriterService,
  testReadModelService,
} from "./utils.js";

describe("handleEServiceEvent test", async () => {
  vi.spyOn(testM2mEventWriterService, "insertEServiceM2MEvent");

  beforeEach(async () => {
    vi.clearAllMocks();
    await addOneDelegationToReadModel(
      getMockDelegation({
        kind: delegationKind.delegatedProducer,
      })
    );
  });

  const draftEservice1: EService = {
    ...getMockEService(),
    descriptors: [getMockDescriptor(descriptorState.draft)],
  };

  const draftEservice2: EService = {
    ...getMockEService(),
    descriptors: [getMockDescriptor(descriptorState.waitingForApproval)],
  };

  const publishedEservice: EService = {
    ...getMockEService(),
    descriptors: [
      getMockDescriptor(descriptorState.published),
      getMockDescriptor(randomArrayItem(Object.values(descriptorState))),
      getMockDescriptor(randomArrayItem(Object.values(descriptorState))),
    ],
  };

  describe.each([
    { testCase: "Draft", eservice: draftEservice1 },
    {
      testCase: "Draft with delegation",
      eservice: draftEservice2,
      delegation: getMockDelegation({
        eserviceId: draftEservice2.id,
        kind: delegationKind.delegatedProducer,
        delegatorId: draftEservice2.producerId,
        delegateId: generateId<TenantId>(),
        state: delegationState.active,
      }),
    },
    {
      testCase: "Published",
      eservice: publishedEservice,
      delegation: undefined,
    },
  ])("with $testCase eservice", ({ testCase, eservice, delegation }) => {
    it.each(
      EServiceEventV2.options.map((o) => ({
        ...getMockEventEnvelopeCommons(),
        stream_id: eservice.id,
        type: o.shape.type.value,
        data: {
          eservice: toEServiceV2(eservice),
          descriptorId: o.shape.type.value.includes("Descriptor")
            ? eservice.descriptors[0].id
            : undefined,
        },
      })) as EServiceEventEnvelopeV2[]
    )(
      "should write M2M event for $type event",
      async (message: EServiceEventEnvelopeV2) => {
        const eventTimestamp = new Date();

        if (delegation) {
          await addOneDelegationToReadModel(delegation);
        }

        const visibilityFields = match(testCase)
          .with("Published", () => ({
            visibility: m2mEventVisibility.public,
          }))
          .with("Draft", () => ({
            visibility: m2mEventVisibility.restricted,
            producerId: eservice.producerId,
            producerDelegateId: undefined,
            producerDelegationId: undefined,
          }))
          .with("Draft with delegation", () => ({
            visibility: m2mEventVisibility.restricted,
            producerId: eservice.producerId,
            producerDelegateId: delegation!.delegateId,
            producerDelegationId: delegation!.id,
          }))
          .run();

        await handleEServiceEvent(
          message,
          eventTimestamp,
          genericLogger,
          testM2mEventWriterService,
          testReadModelService
        );

        await match(message)
          .with(
            {
              type: P.union(
                "EServiceAdded",
                "DraftEServiceUpdated",
                "EServiceCloned",
                "EServiceDeleted",
                "EServiceNameUpdated",
                "EServiceDescriptionUpdated",
                "EServiceIsConsumerDelegableEnabled",
                "EServiceIsConsumerDelegableDisabled",
                "EServiceIsClientAccessDelegableEnabled",
                "EServiceIsClientAccessDelegableDisabled",
                "EServiceNameUpdatedByTemplateUpdate",
                "EServiceDescriptionUpdatedByTemplateUpdate",
                "EServiceSignalHubEnabled",
                "EServiceSignalHubDisabled",
                "EServiceRiskAnalysisAdded",
                "EServiceRiskAnalysisUpdated",
                "EServiceRiskAnalysisDeleted"
              ),
            },
            async (m) => {
              expect(
                testM2mEventWriterService.insertEServiceM2MEvent
              ).toHaveBeenCalledTimes(1);
              const eserviceM2MEvent = await retrieveLastEServiceM2MEvent();
              const expectedEserviceM2MEvent: EServiceM2MEvent = {
                id: expect.any(String),
                eventType: m.type,
                eventTimestamp,
                eserviceId: eservice.id,
                ...visibilityFields,
              };
              expect(eserviceM2MEvent).toEqual(expectedEserviceM2MEvent);
            }
          )
          .with(
            {
              type: P.union(
                "EServiceDescriptorPublished",
                "EServiceDescriptorActivated",
                "EServiceDescriptorApprovedByDelegator",
                "EServiceDescriptorSuspended",
                "EServiceDescriptorArchived",
                "EServiceDescriptorQuotasUpdated",
                "EServiceDescriptorAgreementApprovalPolicyUpdated",
                "EServiceDescriptorAdded",
                "EServiceDraftDescriptorDeleted",
                "EServiceDraftDescriptorUpdated",
                "EServiceDescriptorAttributesUpdated",
                "EServiceDescriptorSubmittedByDelegate",
                "EServiceDescriptorRejectedByDelegator",
                "EServiceDescriptorAttributesUpdatedByTemplateUpdate",
                "EServiceDescriptorQuotasUpdatedByTemplateUpdate",
                "EServiceDescriptorDocumentAdded",
                "EServiceDescriptorDocumentUpdated",
                "EServiceDescriptorDocumentDeleted",
                "EServiceDescriptorDocumentAddedByTemplateUpdate",
                "EServiceDescriptorDocumentDeletedByTemplateUpdate",
                "EServiceDescriptorDocumentUpdatedByTemplateUpdate",
                "EServiceDescriptorInterfaceAdded",
                "EServiceDescriptorInterfaceUpdated",
                "EServiceDescriptorInterfaceDeleted"
              ),
            },
            async (m) => {
              expect(
                testM2mEventWriterService.insertEServiceM2MEvent
              ).toHaveBeenCalledTimes(1);
              const eserviceM2MEvent = await retrieveLastEServiceM2MEvent();
              const expectedEserviceM2MEvent: EServiceM2MEvent = {
                id: expect.any(String),
                eventType: m.type,
                eventTimestamp,
                eserviceId: eservice.id,
                descriptorId: eservice.descriptors[0].id,
                ...visibilityFields,
              };
              expect(eserviceM2MEvent).toEqual(expectedEserviceM2MEvent);
            }
          )
          .exhaustive();
      }
    );
  });
});
