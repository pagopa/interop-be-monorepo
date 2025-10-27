import {
  AgreementEventEnvelopeV2,
  fromAgreementV2,
  missingKafkaMessageDataError,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { AgreementWriterService } from "./agreementWriterService.js";

export async function handleMessageV2(
  message: AgreementEventEnvelopeV2,
  agreementWriterService: AgreementWriterService
): Promise<void> {
  const agreementV2 = message.data.agreement;
  if (!agreementV2) {
    throw missingKafkaMessageDataError("agreement", message.type);
  }
  const agreement = fromAgreementV2(agreementV2);

  await match(message)
    .with(
      { type: "AgreementDeleted" },
      { type: "AgreementDeletedByRevokedDelegation" },
      async (message) => {
        await agreementWriterService.deleteAgreementById(
          agreement.id,
          message.version
        );
      }
    )
    .with(
      { type: "AgreementAdded" },
      { type: "DraftAgreementUpdated" },
      { type: "AgreementSubmitted" },
      { type: "AgreementActivated" },
      { type: "AgreementUpgraded" },
      { type: "AgreementUnsuspendedByProducer" },
      { type: "AgreementUnsuspendedByConsumer" },
      { type: "AgreementUnsuspendedByPlatform" },
      { type: "AgreementArchivedByConsumer" },
      { type: "AgreementSuspendedByProducer" },
      { type: "AgreementSuspendedByConsumer" },
      { type: "AgreementSuspendedByPlatform" },
      { type: "AgreementRejected" },
      { type: "AgreementConsumerDocumentAdded" },
      { type: "AgreementConsumerDocumentRemoved" },
      { type: "AgreementArchivedByUpgrade" },
      { type: "AgreementSetDraftByPlatform" },
      { type: "AgreementSetMissingCertifiedAttributesByPlatform" },
      { type: "AgreementArchivedByRevokedDelegation" },
      { type: "AgreementContractGenerated" },
      async (message) => {
        await agreementWriterService.upsertAgreement(
          agreement,
          message.version
        );
      }
    )
    .exhaustive();
}
