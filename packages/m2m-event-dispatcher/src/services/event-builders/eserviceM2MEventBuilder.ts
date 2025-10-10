import {
  Delegation,
  Descriptor,
  DescriptorId,
  DescriptorState,
  EService,
  EServiceM2MEvent,
  descriptorState,
  m2mEventVisibility,
} from "pagopa-interop-models";
import { match, P } from "ts-pattern";
import { generateM2MEventId } from "../../utils/uuidv7.js";
import { descriptorNotFoundInEService } from "../../models/errors.js";

export async function createEServiceM2MEvent(
  eservice: EService,
  eventType: EServiceM2MEvent["eventType"],
  eventTimestamp: Date,
  producerDelegation: Delegation | undefined
): Promise<EServiceM2MEvent> {
  return createEServiceM2MEventHelper(
    eservice,
    undefined,
    eventType,
    eventTimestamp,
    producerDelegation
  );
}

export async function createEServiceDescriptorM2MEvent(
  eservice: EService,
  descriptorId: DescriptorId,
  eventType: EServiceM2MEvent["eventType"],
  eventTimestamp: Date,
  producerDelegation: Delegation | undefined
): Promise<EServiceM2MEvent> {
  return createEServiceM2MEventHelper(
    eservice,
    descriptorId,
    eventType,
    eventTimestamp,
    producerDelegation
  );
}

/**
 * Helper function to create a new EServiceM2MEvent.
 * Do not export this function directly; use the specific functions above instead.
 */
function createEServiceM2MEventHelper(
  eservice: EService,
  descriptorId: DescriptorId | undefined,
  eventType: EServiceM2MEvent["eventType"],
  eventTimestamp: Date,
  producerDelegation: Delegation | undefined
): EServiceM2MEvent {
  return {
    id: generateM2MEventId(),
    eventType,
    eventTimestamp,
    eserviceId: eservice.id,
    descriptorId,
    producerId: eservice.producerId,
    producerDelegateId: producerDelegation?.delegateId,
    producerDelegationId: producerDelegation?.id,
    visibility: getEServiceM2MEventVisibility(
      eventType,
      eservice,
      descriptorId
    ),
  };
}

/**
 * Helper function to determine the visibility of an EServiceM2MEvent,
 * based on the event type; fallback to the state of the E-Service and its Descriptors if needed.
 */
function getEServiceM2MEventVisibility(
  eventType: EServiceM2MEvent["eventType"],
  eservice: EService,
  descriptorId: DescriptorId | undefined
): EServiceM2MEvent["visibility"] {
  return match(eventType)
    .with(
      P.union(
        // Draft E-Service events, visible only to the owner (producer or delegate)
        "EServiceAdded",
        "DraftEServiceUpdated",
        "EServiceCloned",
        "EServiceDeleted",
        "EServiceRiskAnalysisAdded",
        "EServiceRiskAnalysisUpdated",
        "EServiceRiskAnalysisDeleted",
        "EServiceDescriptorAdded",
        "EServiceDraftDescriptorDeleted",
        "EServiceDraftDescriptorUpdated",
        "EServiceDescriptorSubmittedByDelegate",
        "EServiceDescriptorRejectedByDelegator",
        "EServiceDescriptorInterfaceAdded",
        "EServiceDescriptorInterfaceUpdated",
        "EServiceDescriptorInterfaceDeleted"
      ),
      () => m2mEventVisibility.owner
    )
    .with(
      P.union(
        // E-Service events after publication, visible to everyone (public)
        "EServiceNameUpdated",
        "EServiceDescriptionUpdated",
        "EServiceIsConsumerDelegableEnabled",
        "EServiceIsConsumerDelegableDisabled",
        "EServiceIsClientAccessDelegableEnabled",
        "EServiceIsClientAccessDelegableDisabled",
        "EServiceSignalHubEnabled",
        "EServiceSignalHubDisabled",
        "EServiceDescriptorPublished",
        "EServiceDescriptorActivated",
        "EServiceDescriptorApprovedByDelegator",
        "EServiceDescriptorSuspended",
        "EServiceDescriptorArchived",
        "EServiceDescriptorQuotasUpdated",
        "EServiceDescriptorAgreementApprovalPolicyUpdated",
        "EServiceDescriptorAttributesUpdated",
        "EServicePersonalDataFlagUpdatedAfterPublication"
      ),
      () => m2mEventVisibility.public
    )
    .with(
      P.union(
        // Events that apply both to draft and published E-Services,
        // visibility depends on the state of the E-Service Descriptors
        "EServiceDescriptorDocumentAdded",
        "EServiceDescriptorDocumentUpdated",
        "EServiceDescriptorDocumentDeleted",
        "EServiceNameUpdatedByTemplateUpdate",
        "EServiceDescriptionUpdatedByTemplateUpdate",
        "EServiceDescriptorAttributesUpdatedByTemplateUpdate",
        "EServiceDescriptorQuotasUpdatedByTemplateUpdate",
        "EServiceDescriptorDocumentAddedByTemplateUpdate",
        "EServiceDescriptorDocumentDeletedByTemplateUpdate",
        "EServiceDescriptorDocumentUpdatedByTemplateUpdate"
      ),
      () => getEServiceM2MEventVisibilityFromEService(eservice, descriptorId)
    )
    .exhaustive();
}

const ownerVisibilityStates: DescriptorState[] = [
  descriptorState.draft,
  descriptorState.waitingForApproval,
];

function getEServiceM2MEventVisibilityFromEService(
  eservice: EService,
  descriptorId: DescriptorId | undefined
): EServiceM2MEvent["visibility"] {
  const descriptor = descriptorId
    ? retrieveDescriptorFromEService(descriptorId, eservice)
    : undefined;
  if (
    (descriptor !== undefined &&
      ownerVisibilityStates.includes(descriptor.state)) ||
    eservice.descriptors.every((d) => ownerVisibilityStates.includes(d.state))
  ) {
    return m2mEventVisibility.owner;
  } else {
    return m2mEventVisibility.public;
  }
}

const retrieveDescriptorFromEService = (
  descriptorId: DescriptorId,
  eservice: EService
): Descriptor => {
  const descriptor = eservice.descriptors.find(
    (d: Descriptor) => d.id === descriptorId
  );

  if (descriptor === undefined) {
    throw descriptorNotFoundInEService(descriptorId, eservice.id);
  }

  return descriptor;
};
