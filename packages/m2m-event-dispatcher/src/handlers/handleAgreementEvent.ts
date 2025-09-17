import { AgreementEventEnvelopeV2 } from "pagopa-interop-models";
import { Logger } from "pagopa-interop-commons";
import { match, P } from "ts-pattern";
import { ReadModelServiceSQL } from "../services/readModelServiceSQL.js";
import { M2MEventServiceSQL } from "../services/m2mEventServiceSQL.js";

export async function handleAgreementEvent(
  decodedMessage: AgreementEventEnvelopeV2,
  _logger: Logger,
  _m2mEventService: M2MEventServiceSQL,
  _readModelService: ReadModelServiceSQL
): Promise<void> {
  return match(decodedMessage)
    .with(
      {
        type: P.union(
          "AgreementSuspendedByConsumer",
          "AgreementUnsuspendedByConsumer",
          "AgreementSuspendedByProducer",
          "AgreementUnsuspendedByProducer",
          "AgreementSuspendedByPlatform",
          "AgreementUnsuspendedByPlatform",
          "AgreementArchivedByConsumer",
          "AgreementSubmitted",
          "AgreementUpgraded",
          "AgreementActivated",
          "AgreementRejected",
          "AgreementAdded",
          "AgreementDeleted",
          "DraftAgreementUpdated",
          "AgreementArchivedByUpgrade",
          "AgreementConsumerDocumentAdded",
          "AgreementConsumerDocumentRemoved",
          "AgreementSetDraftByPlatform",
          "AgreementSetMissingCertifiedAttributesByPlatform",
          "AgreementDeletedByRevokedDelegation",
          "AgreementArchivedByRevokedDelegation"
        ),
      },
      () => Promise.resolve(void 0)
    )
    .exhaustive();
}
