import {
  Agreement,
  AgreementM2MEvent,
  m2mEventVisibility,
  agreementState,
  AgreementState,
} from "pagopa-interop-models";
import { match, P } from "ts-pattern";
import { generateM2MEventId } from "../../utils/uuidv7.js";
import { Delegations } from "../../models/delegations.js";

export async function createAgreementM2MEvent(
  agreement: Agreement,
  eventType: AgreementM2MEvent["eventType"],
  eventTimestamp: Date,
  delegations: Delegations
): Promise<AgreementM2MEvent> {
  return {
    id: generateM2MEventId(),
    eventType,
    eventTimestamp,
    agreementId: agreement.id,
    producerId: agreement.producerId,
    consumerId: agreement.consumerId,
    consumerDelegateId: delegations.consumerDelegation?.delegateId,
    consumerDelegationId: delegations.consumerDelegation?.id,
    producerDelegateId: delegations.producerDelegation?.delegateId,
    producerDelegationId: delegations.producerDelegation?.id,
    visibility: getAgreementM2MEventVisibility(eventType, agreement),
  };
}

/**
 * Helper function to determine the visibility of an AgreementM2MEvent,
 * based on the event type; fallback to the state of the E-Service and its Descriptors if needed.
 */
function getAgreementM2MEventVisibility(
  eventType: AgreementM2MEvent["eventType"],
  agreement: Agreement
): AgreementM2MEvent["visibility"] {
  return match(eventType)
    .with(
      P.union(
        // Draft Agreement events, visible only to the owner (consumer or delegate)
        "AgreementAdded",
        "DraftAgreementUpdated",
        "AgreementSetDraftByPlatform",
        "AgreementSetMissingCertifiedAttributesByPlatform",
        "AgreementConsumerDocumentAdded",
        "AgreementConsumerDocumentRemoved",
        "AgreementContractGenerated"
      ),
      () => m2mEventVisibility.owner
    )
    .with(
      P.union(
        // Agreement events after submission, visibility restricted to producer/consumer/delegates
        "AgreementActivated",
        "AgreementSubmitted",
        "AgreementUpgraded",
        "AgreementRejected",
        "AgreementSuspendedByProducer",
        "AgreementSuspendedByConsumer",
        "AgreementSuspendedByPlatform",
        "AgreementUnsuspendedByProducer",
        "AgreementUnsuspendedByConsumer",
        "AgreementUnsuspendedByPlatform",
        "AgreementArchivedByConsumer",
        "AgreementArchivedByUpgrade",
        "AgreementArchivedByRevokedDelegation"
      ),
      () => m2mEventVisibility.restricted
    )
    .with(
      // Events that apply both to draft and pending submitted Agreements,
      // visibility depends on the state
      P.union("AgreementDeleted", "AgreementDeletedByRevokedDelegation"),
      () => getAgreementM2MEventVisibilityFromAgreement(agreement)
    )
    .exhaustive();
}

const ownerVisibilityStates: AgreementState[] = [
  agreementState.draft,
  agreementState.missingCertifiedAttributes,
];

function getAgreementM2MEventVisibilityFromAgreement(
  agreement: Agreement
): AgreementM2MEvent["visibility"] {
  if (ownerVisibilityStates.includes(agreement.state)) {
    return m2mEventVisibility.owner;
  } else {
    return m2mEventVisibility.restricted;
  }
}
