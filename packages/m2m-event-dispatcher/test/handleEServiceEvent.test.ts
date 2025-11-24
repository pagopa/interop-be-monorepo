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
  delegationKind,
  generateId,
  delegationState,
  TenantId,
  Delegation,
  EServiceId,
} from "pagopa-interop-models";
import { genericLogger } from "pagopa-interop-commons";
import { P, match } from "ts-pattern";
import { handleEServiceEvent } from "../src/handlers/handleEServiceEvent.js";
import {
  addOneDelegationToReadModel,
  getMockEventEnvelopeCommons,
  retrieveAllEServiceM2MEvents,
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

  describe.each(EServiceEventV2.options.map((o) => o.shape.type.value))(
    "with %s event",
    (eventType: EServiceEventV2["type"]) =>
      describe.each(["with Delegation", "without Delegation"] as const)(
        "test case: %s",
        async (delegationTestCase) =>
          it("should write M2M events with the right visibility", async () => {
            let delegation: Delegation | undefined;

            const eserviceId = generateId<EServiceId>();
            const producerId = generateId<TenantId>();

            await match(delegationTestCase)
              .with("with Delegation", async () => {
                delegation = getMockDelegation({
                  eserviceId,
                  kind: delegationKind.delegatedProducer,
                  delegatorId: producerId,
                  delegateId: generateId<TenantId>(),
                  state: delegationState.active,
                });
                await addOneDelegationToReadModel(delegation);
              })
              .with("without Delegation", async () => void 0)
              .exhaustive();

            const eventTimestamp = new Date();

            const testCasesData = await match(eventType)
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
                async () => [
                  {
                    descriptors: [
                      getMockDescriptor(
                        randomArrayItem(Object.values(descriptorState))
                      ),
                      getMockDescriptor(
                        randomArrayItem(Object.values(descriptorState))
                      ),
                      // Visibility based only on event, descriptors state doesn't matter
                    ],
                    affectedDescriptor: undefined,
                    expectedVisibility: m2mEventVisibility.owner,
                  },
                ]
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
                async () => [
                  {
                    descriptors: [
                      getMockDescriptor(
                        randomArrayItem(Object.values(descriptorState))
                      ),
                      getMockDescriptor(
                        randomArrayItem(Object.values(descriptorState))
                      ),
                      // Visibility based only on event, descriptors state doesn't matter
                    ],
                    affectedDescriptor: 1,
                    expectedVisibility: m2mEventVisibility.owner,
                  },
                ]
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
                  "EServiceSignalHubDisabled",
                  "EServicePersonalDataFlagUpdatedAfterPublication",
                  "EServicePersonalDataFlagUpdatedByTemplateUpdate"
                ),
                async () => [
                  {
                    descriptors: [
                      getMockDescriptor(
                        randomArrayItem(Object.values(descriptorState))
                      ),
                      getMockDescriptor(
                        randomArrayItem(Object.values(descriptorState))
                      ),
                      // Visibility based only on event, descriptors state doesn't matter
                    ],
                    affectedDescriptor: undefined,
                    expectedVisibility: m2mEventVisibility.public,
                  },
                ]
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
                async () => [
                  {
                    descriptors: [
                      getMockDescriptor(
                        randomArrayItem(Object.values(descriptorState))
                      ),
                      getMockDescriptor(
                        randomArrayItem(Object.values(descriptorState))
                      ),
                      // Visibility based only on event, descriptors state doesn't matter
                    ],
                    affectedDescriptor: 1,
                    expectedVisibility: m2mEventVisibility.public,
                  },
                ]
              )
              .with(
                P.union(
                  // E-Service events both for Draft and Published E-Services,
                  // visibility depends on the state
                  "EServiceNameUpdatedByTemplateUpdate",
                  "EServiceDescriptionUpdatedByTemplateUpdate"
                ),
                async () => [
                  {
                    // Published e-service, public visibility even if a draft descriptor exists
                    descriptors: [
                      getMockDescriptor(descriptorState.deprecated),
                      getMockDescriptor(descriptorState.published),
                      getMockDescriptor(descriptorState.draft),
                    ],
                    affectedDescriptor: undefined,
                    expectedVisibility: m2mEventVisibility.public,
                  },
                  // All descriptors in draft / waiting for approval, owner visibility
                  {
                    descriptors: [getMockDescriptor(descriptorState.draft)],
                    affectedDescriptor: undefined,
                    expectedVisibility: m2mEventVisibility.owner,
                  },
                  {
                    descriptors: [
                      getMockDescriptor(descriptorState.waitingForApproval),
                    ],
                    affectedDescriptor: undefined,
                    expectedVisibility: m2mEventVisibility.owner,
                  },
                ]
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
                async () => [
                  {
                    // Affected descriptor is published, public visibility
                    descriptors: [
                      getMockDescriptor(descriptorState.deprecated),
                      getMockDescriptor(descriptorState.published),
                      getMockDescriptor(descriptorState.draft),
                    ],
                    affectedDescriptor: 1,
                    expectedVisibility: m2mEventVisibility.public,
                  },
                  // Affected descriptor is draft or waiting for approval, owner visibility
                  {
                    descriptors: [
                      getMockDescriptor(descriptorState.published),
                      getMockDescriptor(descriptorState.draft),
                    ],
                    affectedDescriptor: 1,
                    expectedVisibility: m2mEventVisibility.owner,
                  },
                  {
                    // Affected descriptor is draft, owner visibility
                    descriptors: [
                      getMockDescriptor(descriptorState.waitingForApproval),
                    ],
                    affectedDescriptor: 0,
                    expectedVisibility: m2mEventVisibility.owner,
                  },
                ]
              )
              .exhaustive();

            for (const {
              descriptors,
              affectedDescriptor,
              expectedVisibility,
            } of testCasesData) {
              const eservice = getMockEService(
                eserviceId,
                producerId,
                descriptors
              );

              const descriptorId = affectedDescriptor
                ? eservice.descriptors.at(affectedDescriptor)!.id
                : undefined;

              const message = {
                ...getMockEventEnvelopeCommons(),
                stream_id: eservice.id,
                type: eventType,
                data: {
                  eservice: toEServiceV2(eservice),
                  descriptorId,
                },
              } as EServiceEventEnvelopeV2;

              await handleEServiceEvent(
                message,
                eventTimestamp,
                genericLogger,
                testM2mEventWriterService,
                testReadModelService
              );
              expect(
                testM2mEventWriterService.insertEServiceM2MEvent
              ).toHaveBeenCalledTimes(1);
              vi.clearAllMocks();

              const actualM2MEvent = await retrieveLastEServiceM2MEvent();
              expect(actualM2MEvent).toEqual({
                id: expect.any(String),
                eventType,
                eventTimestamp,
                resourceVersion: message.version,
                eserviceId: eservice.id,
                descriptorId,
                producerId: eservice.producerId,
                producerDelegateId: delegation?.delegateId,
                producerDelegationId: delegation?.id,
                visibility: expectedVisibility,
              });
            }
          })
      )
  );

  it("should not write the event if the same resource version is already present", async () => {
    const eservice = getMockEService();

    const message = {
      ...getMockEventEnvelopeCommons(),
      stream_id: eservice.id,
      type: "EServiceAdded",
      data: {
        eservice: toEServiceV2(eservice),
      },
    } as EServiceEventEnvelopeV2;

    const eventTimestamp = new Date();

    // Insert the event for the first time
    await handleEServiceEvent(
      message,
      eventTimestamp,
      genericLogger,
      testM2mEventWriterService,
      testReadModelService
    );

    // Try to insert the same event again: should be skipped
    await handleEServiceEvent(
      message,
      eventTimestamp,
      genericLogger,
      testM2mEventWriterService,
      testReadModelService
    );

    // Try to insert one with a further resource version: should be inserted
    await handleEServiceEvent(
      { ...message, version: message.version + 1 },
      eventTimestamp,
      genericLogger,
      testM2mEventWriterService,
      testReadModelService
    );

    expect(
      testM2mEventWriterService.insertEServiceM2MEvent
    ).toHaveBeenCalledTimes(3);

    expect(await retrieveAllEServiceM2MEvents({ limit: 10 })).toHaveLength(2);
  });
});
