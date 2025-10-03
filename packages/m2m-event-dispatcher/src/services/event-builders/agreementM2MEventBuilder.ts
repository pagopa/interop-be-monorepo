import {
  Delegation,
  Agreement,
  AgreementM2MEvent,
  M2MEventVisibility,
  m2mEventVisibility,
} from "pagopa-interop-models";
import { match, P } from "ts-pattern";
import { generateM2MEventId } from "../../utils/uuidv7.js";

export async function createAgreementM2MEvent(
  agreement: Agreement,
  eventType: AgreementM2MEvent["eventType"],
  eventTimestamp: Date,
  delegations: {
    producer: Delegation | undefined;
    consumer: Delegation | undefined;
  }
): Promise<AgreementM2MEvent> {
  return {
    id: generateM2MEventId(),
    eventType,
    eventTimestamp,
    agreementId: agreement.id,
    producerId: agreement.producerId,
    consumerId: agreement.consumerId,
    consumerDelegateId: delegations.consumer?.delegateId,
    consumerDelegationId: delegations.consumer?.id,
    producerDelegateId: delegations.producer?.delegateId,
    producerDelegationId: delegations.producer?.id,
    visibility: getAgreementM2MEventVisibility(eventType),
  };
}

/**
 * Helper function to determine the visibility of an AgreementM2MEvent,
 * based on the event type; fallback to the state of the E-Service and its Descriptors if needed.
 */
function getAgreementM2MEventVisibility(
  eventType: AgreementM2MEvent["eventType"]
): Extract<M2MEventVisibility, "Public" | "Owner"> {
  return match(eventType)
    .with(
      P.union(
        "AgreementAdded",
        "AgreementDeleted",
        "DraftAgreementUpdated",
        "AgreementSubmitted",
        "AgreementActivated",
        "AgreementUnsuspendedByProducer",
        "AgreementUnsuspendedByConsumer",
        "AgreementUnsuspendedByPlatform",
        "AgreementArchivedByConsumer",
        "AgreementArchivedByUpgrade",
        "AgreementUpgraded",
        "AgreementSuspendedByProducer",
        "AgreementSuspendedByConsumer",
        "AgreementSuspendedByPlatform",
        "AgreementRejected",
        "AgreementConsumerDocumentAdded",
        "AgreementConsumerDocumentRemoved",
        "AgreementSetDraftByPlatform",
        "AgreementSetMissingCertifiedAttributesByPlatform",
        "AgreementDeletedByRevokedDelegation",
        "AgreementArchivedByRevokedDelegation"
      ),
      () => m2mEventVisibility.public // TODO
    )
    .exhaustive();
}
