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

  const draftEService1: EService = {
    ...getMockEService(),
    descriptors: [getMockDescriptor(descriptorState.draft)],
  };

  const draftEService2: EService = {
    ...getMockEService(),
    descriptors: [getMockDescriptor(descriptorState.waitingForApproval)],
  };

  const publishedEService: EService = {
    ...getMockEService(),
    descriptors: [
      getMockDescriptor(descriptorState.published),
      getMockDescriptor(randomArrayItem(Object.values(descriptorState))),
      getMockDescriptor(randomArrayItem(Object.values(descriptorState))),
    ],
  };

  const testCases = [
    { testCase: "Draft", eservice: draftEService1, delegation: undefined },
    {
      testCase: "Published",
      eservice: publishedEService,
      delegation: undefined,
    },
    {
      testCase: "WaitingForApproval with Delegation",
      eservice: draftEService2,
      delegation: getMockDelegation({
        eserviceId: draftEService2.id,
        kind: delegationKind.delegatedProducer,
        delegatorId: draftEService2.producerId,
        delegateId: generateId<TenantId>(),
        state: delegationState.active,
      }),
    },
    {
      testCase: "Published with Delegation",
      eservice: publishedEService,
      delegation: getMockDelegation({
        eserviceId: publishedEService.id,
        kind: delegationKind.delegatedProducer,
        delegatorId: publishedEService.producerId,
        delegateId: generateId<TenantId>(),
        state: delegationState.active,
      }),
    },
    /** Draft events cannot contain a Published E-Service and viceversa.
     * However, some events apply both to Draft and Published E-Services.
     * We test all combinations, to check that:
     * - Draft events are always owner-visible, regardless of the E-Service state;
     * - Published events are always public-visible, regardless of the E-Service state;
     * - Events that apply to both Draft and Published E-Services have the right visibility,
     *   depending on the actual state of the E-Service.
     */
  ] as const;

  describe.each(EServiceEventV2.options.map((o) => o.shape.type.value))(
    "with %s event",
    (eventType: EServiceEventV2["type"]) => {
      it.each(testCases)(
        "should write M2M event with the right visibility (E-Service: $testCase)",
        async ({ testCase, eservice, delegation }) => {
          if (delegation) {
            await addOneDelegationToReadModel(delegation);
          }

          const messageWithEService = {
            ...getMockEventEnvelopeCommons(),
            stream_id: eservice.id,
            type: eventType,
            data: {
              eservice: toEServiceV2(eservice),
            },
          } as EServiceEventEnvelopeV2;

          const messageWithDescriptorId = {
            ...messageWithEService,
            data: {
              ...messageWithEService.data,
              descriptorId: eservice.descriptors[0].id,
            },
          } as EServiceEventEnvelopeV2;

          const eventTimestamp = new Date();

          const { messageToHandle, expectedM2MEvent } = await match(eventType)
            .with(
              P.union(
                // Draft E-Service events, owner visibility
                "EServiceAdded",
                "DraftEServiceUpdated",
                "EServiceCloned",
                "EServiceDeleted",
                "EServiceRiskAnalysisAdded",
                "EServiceRiskAnalysisUpdated",
                "EServiceRiskAnalysisDeleted"
              ),
              async () => ({
                messageToHandle: messageWithEService,
                expectedM2MEvent: {
                  id: expect.any(String),
                  eventType: messageWithEService.type,
                  eventTimestamp,
                  eserviceId: eservice.id,
                  descriptorId: undefined,
                  producerId: eservice.producerId,
                  producerDelegateId: delegation?.delegateId,
                  producerDelegationId: delegation?.id,
                  visibility: m2mEventVisibility.owner,
                },
              })
            )
            .with(
              P.union(
                // Draft E-Service Descriptor events, owner visibility
                "EServiceDescriptorAdded",
                "EServiceDraftDescriptorDeleted",
                "EServiceDraftDescriptorUpdated",
                "EServiceDescriptorSubmittedByDelegate",
                "EServiceDescriptorRejectedByDelegator",
                "EServiceDescriptorInterfaceAdded",
                "EServiceDescriptorInterfaceUpdated",
                "EServiceDescriptorInterfaceDeleted"
              ),
              async () => ({
                messageToHandle: messageWithDescriptorId,
                expectedM2MEvent: {
                  id: expect.any(String),
                  eventType: messageWithDescriptorId.type,
                  eventTimestamp,
                  eserviceId: eservice.id,
                  descriptorId: eservice.descriptors[0].id,
                  producerId: eservice.producerId,
                  producerDelegateId: delegation?.delegateId,
                  producerDelegationId: delegation?.id,
                  visibility: m2mEventVisibility.owner,
                },
              })
            )
            .with(
              P.union(
                // E-Service events after publication, public visibility
                "EServiceNameUpdated",
                "EServiceDescriptionUpdated",
                "EServiceIsConsumerDelegableEnabled",
                "EServiceIsConsumerDelegableDisabled",
                "EServiceIsClientAccessDelegableEnabled",
                "EServiceIsClientAccessDelegableDisabled",
                "EServiceSignalHubEnabled",
                "EServiceSignalHubDisabled"
              ),
              async () => ({
                messageToHandle: messageWithEService,
                expectedM2MEvent: {
                  id: expect.any(String),
                  eventType: messageWithEService.type,
                  eventTimestamp,
                  eserviceId: eservice.id,
                  descriptorId: undefined,
                  producerId: eservice.producerId,
                  producerDelegateId: delegation?.delegateId,
                  producerDelegationId: delegation?.id,
                  visibility: m2mEventVisibility.public,
                },
              })
            )
            .with(
              P.union(
                // E-Service Descriptor events after publication, public visibility
                "EServiceDescriptorPublished",
                "EServiceDescriptorActivated",
                "EServiceDescriptorApprovedByDelegator",
                "EServiceDescriptorSuspended",
                "EServiceDescriptorArchived",
                "EServiceDescriptorQuotasUpdated",
                "EServiceDescriptorAgreementApprovalPolicyUpdated",
                "EServiceDescriptorAttributesUpdated"
              ),
              async () => ({
                messageToHandle: messageWithDescriptorId,
                expectedM2MEvent: {
                  id: expect.any(String),
                  eventType: messageWithEService.type,
                  eventTimestamp,
                  eserviceId: eservice.id,
                  descriptorId: eservice.descriptors[0].id,
                  producerId: eservice.producerId,
                  producerDelegateId: delegation?.delegateId,
                  producerDelegationId: delegation?.id,
                  visibility: m2mEventVisibility.public,
                },
              })
            )
            .with(
              P.union(
                // E-Service events both for Draft and Published E-Services,
                // visibility depends on the state
                "EServiceNameUpdatedByTemplateUpdate",
                "EServiceDescriptionUpdatedByTemplateUpdate"
              ),
              async () => ({
                messageToHandle: messageWithEService,
                expectedM2MEvent: {
                  id: expect.any(String),
                  eventType: messageWithEService.type,
                  eventTimestamp,
                  eserviceId: eservice.id,
                  descriptorId: undefined,
                  producerId: eservice.producerId,
                  producerDelegateId: delegation?.delegateId,
                  producerDelegationId: delegation?.id,
                  visibility: match(testCase)
                    .with(
                      "Draft",
                      "WaitingForApproval with Delegation",
                      () => m2mEventVisibility.owner
                    )
                    .with(
                      "Published",
                      "Published with Delegation",
                      () => m2mEventVisibility.public
                    )
                    .exhaustive(),
                },
              })
            )
            .with(
              P.union(
                // E-Service descriptor events both for Draft and Published E-Services,
                // visibility depends on the state
                "EServiceDescriptorDocumentAdded",
                "EServiceDescriptorDocumentUpdated",
                "EServiceDescriptorDocumentDeleted",
                "EServiceDescriptorAttributesUpdatedByTemplateUpdate",
                "EServiceDescriptorQuotasUpdatedByTemplateUpdate",
                "EServiceDescriptorDocumentAddedByTemplateUpdate",
                "EServiceDescriptorDocumentDeletedByTemplateUpdate",
                "EServiceDescriptorDocumentUpdatedByTemplateUpdate"
              ),
              async () => ({
                messageToHandle: messageWithDescriptorId,
                expectedM2MEvent: {
                  id: expect.any(String),
                  eventType: messageWithEService.type,
                  eventTimestamp,
                  eserviceId: eservice.id,
                  descriptorId: eservice.descriptors[0].id,
                  producerId: eservice.producerId,
                  producerDelegateId: delegation?.delegateId,
                  producerDelegationId: delegation?.id,
                  visibility: match(testCase)
                    .with(
                      "Draft",
                      "WaitingForApproval with Delegation",
                      () => m2mEventVisibility.owner
                    )
                    .with(
                      "Published",
                      "Published with Delegation",
                      () => m2mEventVisibility.public
                    )
                    .exhaustive(),
                },
              })
            )
            .exhaustive();

          await handleEServiceEvent(
            messageToHandle,
            eventTimestamp,
            genericLogger,
            testM2mEventWriterService,
            testReadModelService
          );
          expect(
            testM2mEventWriterService.insertEServiceM2MEvent
          ).toHaveBeenCalledTimes(1);
          const actualM2MEvent = await retrieveLastEServiceM2MEvent();
          expect(actualM2MEvent).toEqual(expectedM2MEvent);
        }
      );
    }
  );
});
