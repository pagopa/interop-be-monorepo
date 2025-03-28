import {
  AgreementEventEnvelopeV2,
  fromAgreementV2,
  genericInternalError,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { ReadModelService } from "./readModelService.js";

export async function handleMessageV2(
  message: AgreementEventEnvelopeV2,
  readModelService: ReadModelService
): Promise<void> {
  await match(message)
    .with(
      { type: "AgreementDeleted" },
      { type: "AgreementDeletedByRevokedDelegation" },
      async (message) => {
        const agreementV2 = message.data.agreement;
        if (!agreementV2) {
          throw genericInternalError(
            "agreement can't be missing in event message"
          );
        }
        await readModelService.deleteAgreementById(
          fromAgreementV2(agreementV2).id,
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
      async (message) => {
        const agreementV2 = message.data.agreement;

        if (!agreementV2) {
          throw genericInternalError(
            "agreement can't be missing in event message"
          );
        }
        await readModelService.upsertAgreement(
          fromAgreementV2(agreementV2),
          message.version
        );
      }
    )
    .exhaustive();
}
