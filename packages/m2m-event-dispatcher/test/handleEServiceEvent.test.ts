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

  describe.each(EServiceEventV2.options.map((o) => o.shape.type.value))(
    "with %s event",
    (eventType: EServiceEventV2["type"]) => {
      it.each([
        { testCase: "Draft", eservice: draftEservice1, delegation: undefined },
        {
          testCase: "Published",
          eservice: publishedEservice,
          delegation: undefined,
        },
        {
          testCase: "WaitingForApproval with Delegation",
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
          testCase: "Published with Delegation",
          eservice: publishedEservice,
          delegation: getMockDelegation({
            eserviceId: publishedEservice.id,
            kind: delegationKind.delegatedProducer,
            delegatorId: publishedEservice.producerId,
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
      ])(
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

          const eventTimestamp = new Date();

          await match(eventType)
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
              async () => {
                await handleEServiceEvent(
                  messageWithEService,
                  eventTimestamp,
                  genericLogger,
                  testM2mEventWriterService,
                  testReadModelService
                );

                expect(
                  testM2mEventWriterService.insertEServiceM2MEvent
                ).toHaveBeenCalledTimes(1);
                const eserviceM2MEvent = await retrieveLastEServiceM2MEvent();
                const expectedEserviceM2MEvent: EServiceM2MEvent = {
                  id: expect.any(String),
                  eventType: messageWithEService.type,
                  eventTimestamp,
                  eserviceId: eservice.id,
                  descriptorId: undefined,
                  producerId: eservice.producerId,
                  producerDelegateId: delegation?.delegateId,
                  producerDelegationId: delegation?.id,
                  visibility: m2mEventVisibility.owner,
                };
                expect(eserviceM2MEvent).toEqual(expectedEserviceM2MEvent);
              }
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
              async () => {
                const messageWithDescriptorId = {
                  ...messageWithEService,
                  data: {
                    ...messageWithEService.data,
                    descriptorId: eservice.descriptors[0].id,
                  },
                } as EServiceEventEnvelopeV2;
                await handleEServiceEvent(
                  messageWithDescriptorId,
                  eventTimestamp,
                  genericLogger,
                  testM2mEventWriterService,
                  testReadModelService
                );

                expect(
                  testM2mEventWriterService.insertEServiceM2MEvent
                ).toHaveBeenCalledTimes(1);
                const eserviceM2MEvent = await retrieveLastEServiceM2MEvent();
                const expectedEserviceM2MEvent: EServiceM2MEvent = {
                  id: expect.any(String),
                  eventType: messageWithDescriptorId.type,
                  eventTimestamp,
                  eserviceId: eservice.id,
                  descriptorId: eservice.descriptors[0].id,
                  producerId: eservice.producerId,
                  producerDelegateId: delegation?.delegateId,
                  producerDelegationId: delegation?.id,
                  visibility: m2mEventVisibility.owner,
                };
                expect(eserviceM2MEvent).toEqual(expectedEserviceM2MEvent);
              }
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
              async () => {
                await handleEServiceEvent(
                  messageWithEService,
                  eventTimestamp,
                  genericLogger,
                  testM2mEventWriterService,
                  testReadModelService
                );

                expect(
                  testM2mEventWriterService.insertEServiceM2MEvent
                ).toHaveBeenCalledTimes(1);
                const eserviceM2MEvent = await retrieveLastEServiceM2MEvent();
                const expectedEserviceM2MEvent: EServiceM2MEvent = {
                  id: expect.any(String),
                  eventType: messageWithEService.type,
                  eventTimestamp,
                  eserviceId: eservice.id,
                  descriptorId: undefined,
                  producerId: eservice.producerId,
                  producerDelegateId: delegation?.delegateId,
                  producerDelegationId: delegation?.id,
                  visibility: m2mEventVisibility.public,
                };
                expect(eserviceM2MEvent).toEqual(expectedEserviceM2MEvent);
              }
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
              async () => {
                const messageWithDescriptorId = {
                  ...messageWithEService,
                  data: {
                    ...messageWithEService.data,
                    descriptorId: eservice.descriptors[0].id,
                  },
                } as EServiceEventEnvelopeV2;
                await handleEServiceEvent(
                  messageWithDescriptorId,
                  eventTimestamp,
                  genericLogger,
                  testM2mEventWriterService,
                  testReadModelService
                );

                expect(
                  testM2mEventWriterService.insertEServiceM2MEvent
                ).toHaveBeenCalledTimes(1);
                const eserviceM2MEvent = await retrieveLastEServiceM2MEvent();
                const expectedEserviceM2MEvent: EServiceM2MEvent = {
                  id: expect.any(String),
                  eventType: messageWithEService.type,
                  eventTimestamp,
                  eserviceId: eservice.id,
                  descriptorId: eservice.descriptors[0].id,
                  producerId: eservice.producerId,
                  producerDelegateId: delegation?.delegateId,
                  producerDelegationId: delegation?.id,
                  visibility: m2mEventVisibility.public,
                };
                expect(eserviceM2MEvent).toEqual(expectedEserviceM2MEvent);
              }
            )
            .with(
              P.union(
                // E-Service events both for Draft and Published E-Services,
                // visibility depends on the state
                "EServiceNameUpdatedByTemplateUpdate",
                "EServiceDescriptionUpdatedByTemplateUpdate"
              ),
              async () => {
                const expectedVisibility = match(testCase)
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
                  .run();

                await handleEServiceEvent(
                  messageWithEService,
                  eventTimestamp,
                  genericLogger,
                  testM2mEventWriterService,
                  testReadModelService
                );

                expect(
                  testM2mEventWriterService.insertEServiceM2MEvent
                ).toHaveBeenCalledTimes(1);
                const eserviceM2MEvent = await retrieveLastEServiceM2MEvent();
                const expectedEserviceM2MEvent: EServiceM2MEvent = {
                  id: expect.any(String),
                  eventType: messageWithEService.type,
                  eventTimestamp,
                  eserviceId: eservice.id,
                  descriptorId: undefined,
                  producerId: eservice.producerId,
                  producerDelegateId: delegation?.delegateId,
                  producerDelegationId: delegation?.id,
                  visibility: expectedVisibility,
                };
                expect(eserviceM2MEvent).toEqual(expectedEserviceM2MEvent);
              }
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
              async () => {
                const messageWithDescriptorId = {
                  ...messageWithEService,
                  data: {
                    ...messageWithEService.data,
                    descriptorId: eservice.descriptors[0].id,
                  },
                } as EServiceEventEnvelopeV2;
                const expectedVisibility = match(testCase)
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
                  .run();

                await handleEServiceEvent(
                  messageWithDescriptorId,
                  eventTimestamp,
                  genericLogger,
                  testM2mEventWriterService,
                  testReadModelService
                );

                expect(
                  testM2mEventWriterService.insertEServiceM2MEvent
                ).toHaveBeenCalledTimes(1);
                const eserviceM2MEvent = await retrieveLastEServiceM2MEvent();
                const expectedEserviceM2MEvent: EServiceM2MEvent = {
                  id: expect.any(String),
                  eventType: messageWithEService.type,
                  eventTimestamp,
                  eserviceId: eservice.id,
                  descriptorId: eservice.descriptors[0].id,
                  producerId: eservice.producerId,
                  producerDelegateId: delegation?.delegateId,
                  producerDelegationId: delegation?.id,
                  visibility: expectedVisibility,
                };
                expect(eserviceM2MEvent).toEqual(expectedEserviceM2MEvent);
              }
            )
            .exhaustive();
        }
      );
    }
  );
});
