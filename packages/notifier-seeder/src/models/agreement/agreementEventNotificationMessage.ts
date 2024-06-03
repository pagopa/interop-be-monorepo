import { AgreementEventEnvelopeV2 } from "pagopa-interop-models";
import { match } from "ts-pattern";
import { v4 as uuidv4 } from "uuid";
import { QueueMessage } from "../../queue-manager/queueMessage.js";
import { AgreementEventNotification } from "./agreementEventNotification.js";

export const eventV2TypeMapper = (
  eventType: AgreementEventEnvelopeV2["type"]
): string =>
  match(eventType)
    .with("AgreementAdded", "AgreementUpgraded", () => "agreement_added")
    .with("AgreementDeleted", () => "agreement_deleted")
    .with(
      "DraftAgreementUpdated",
      "AgreementSubmitted",
      "AgreementActivated",
      "AgreementUnsuspendedByProducer",
      "AgreementUnsuspendedByConsumer",
      "AgreementUnsuspendedByPlatform",
      "AgreementSuspendedByProducer",
      "AgreementSuspendedByConsumer",
      "AgreementSuspendedByPlatform",
      "AgreementSetDraftByPlatform",
      "AgreementSetMissingCertifiedAttributesByPlatform",
      "AgreementRejected",
      "AgreementArchivedByUpgrade",
      "AgreementArchivedByConsumer",
      () => "agreement_updated"
    )
    .with(
      "AgreementConsumerDocumentAdded",
      () => "agreement_consumer_document_added"
    )
    .with(
      "AgreementConsumerDocumentRemoved",
      () => "agreement_consumer_document_removed"
    )
    .exhaustive();

export const buildAgreementMessage = (
  event: AgreementEventEnvelopeV2,
  agreementEvent: AgreementEventNotification
): QueueMessage => ({
  messageUUID: uuidv4(),
  eventJournalPersistenceId: event.stream_id,
  eventJournalSequenceNumber: event.version,
  eventTimestamp: Number(event.log_date),
  kind: eventV2TypeMapper(event.type),
  payload: agreementEvent,
});
