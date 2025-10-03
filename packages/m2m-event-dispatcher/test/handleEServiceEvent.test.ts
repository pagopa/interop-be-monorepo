import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getMockDelegation,
  getMockDescriptor,
  getMockEService,
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

  describe.each(EServiceEventV2.options.map((o) => o.shape.type.value))(
    "with %s event",
    (eventType: EServiceEventV2["type"]) =>
      describe.each(["with Delegation", "without Delegation"] as const)(
        "test case: %s",
        async (delegationTestCase) =>
          it.each([
            descriptorState.draft,
            descriptorState.published,
            // TODO all states?
          ])(
            "should write M2M event with the right visibility for eservice latest descriptor in state %s",
            async (latestDescriptorState) => {
              let delegation: Delegation | undefined;

              const eservice = {
                ...getMockEService(),
                descriptors: [
                  getMockDescriptor(descriptorState.deprecated),
                  getMockDescriptor(descriptorState.published),
                  getMockDescriptor(latestDescriptorState),
                ],
              };

              await match(delegationTestCase)
                .with("with Delegation", async () => {
                  delegation = getMockDelegation({
                    eserviceId: eservice.id,
                    kind: delegationKind.delegatedProducer,
                    delegatorId: eservice.producerId,
                    delegateId: generateId<TenantId>(),
                    state: delegationState.active,
                  });
                  await addOneDelegationToReadModel(delegation);
                })
                .with("without Delegation", async () => void 0)
                .exhaustive();

              const eventTimestamp = new Date();

              const { descriptorId, expectedVisibility } = await match(
                eventType
              )
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
                    descriptorId: undefined,
                    expectedVisibility: m2mEventVisibility.owner,
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
                    descriptorId: eservice.descriptors.at(-1)!.id,
                    expectedVisibility: m2mEventVisibility.owner,
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
                    descriptorId: undefined,
                    expectedVisibility: m2mEventVisibility.public,
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
                    descriptorId: eservice.descriptors.at(-1)!.id,
                    expectedVisibility: m2mEventVisibility.public,
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
                    descriptorId: undefined,
                    expectedVisibility: m2mEventVisibility.public,
                  })
                  // TODO add other case
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
                    descriptorId: eservice.descriptors.at(-1)!.id,
                    expectedVisibility: match(latestDescriptorState)
                      .with(
                        descriptorState.draft,
                        // descriptorState.waitingForApproval,
                        () => m2mEventVisibility.owner
                      )
                      .with(
                        // descriptorState.deprecated,
                        descriptorState.published,
                        // descriptorState.suspended,
                        // descriptorState.archived,
                        () => m2mEventVisibility.public
                      )
                      .exhaustive(),
                    // TODO add other case
                  })
                )
                .exhaustive();

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
              const actualM2MEvent = await retrieveLastEServiceM2MEvent();
              expect(actualM2MEvent).toEqual({
                id: expect.any(String),
                eventType,
                eventTimestamp,
                eserviceId: eservice.id,
                descriptorId,
                producerId: eservice.producerId,
                producerDelegateId: delegation?.delegateId,
                producerDelegationId: delegation?.id,
                visibility: expectedVisibility,
              });
            }
          )
      )
  );
});
