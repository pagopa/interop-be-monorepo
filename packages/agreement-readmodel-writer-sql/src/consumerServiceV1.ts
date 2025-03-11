import { match } from "ts-pattern";
import {
  AgreementEventEnvelopeV1,
  fromAgreementV1,
  genericInternalError,
  AgreementId,
  unsafeBrandId,
  fromAgreementDocumentV1,
  AgreementDocumentId,
} from "pagopa-interop-models";
import { ReadModelService } from "./readModelService.js";

export async function handleMessageV1(
  message: AgreementEventEnvelopeV1,
  readModelService: ReadModelService
): Promise<void> {
  await match(message)
    .with(
      { type: "AgreementAdded" },
      { type: "AgreementUpdated" },
      { type: "AgreementActivated" },
      { type: "AgreementSuspended" },
      { type: "AgreementDeactivated" },
      { type: "VerifiedAttributeUpdated" },
      async (msg) => {
        const agreementV1 = msg.data.agreement;
        if (!agreementV1) {
          throw genericInternalError(
            "agreement can't be missing in event message"
          );
        }

        await readModelService.upsertAgreement({
          data: fromAgreementV1(agreementV1),
          metadata: {
            version: msg.version,
          },
        });
      }
    )
    .with({ type: "AgreementDeleted" }, async (msg) => {
      await readModelService.deleteAgreement(
        unsafeBrandId<AgreementId>(msg.data.agreementId),
        msg.version
      );
    })
    .with({ type: "AgreementConsumerDocumentAdded" }, async (msg) => {
      const consumerDocV1 = msg.data.document;
      if (!consumerDocV1) {
        throw genericInternalError(
          "consumer document can't be missing in event message"
        );
      }
      await readModelService.upsertConsumerDocument(
        fromAgreementDocumentV1(consumerDocV1),
        unsafeBrandId<AgreementId>(msg.data.agreementId),
        msg.version
      );
    })
    .with({ type: "AgreementConsumerDocumentRemoved" }, async (msg) => {
      await readModelService.deleteConsumerDocument(
        unsafeBrandId<AgreementId>(msg.data.agreementId),
        unsafeBrandId<AgreementDocumentId>(msg.data.documentId),
        msg.version
      );
    })
    .with({ type: "AgreementContractAdded" }, async (msg) => {
      const contractV1 = msg.data.contract;
      if (!contractV1) {
        throw genericInternalError(
          "contract can't be missing in event message"
        );
      }
      await readModelService.upsertContractDocument(
        fromAgreementDocumentV1(contractV1),
        unsafeBrandId<AgreementId>(msg.data.agreementId),
        msg.version
      );
    })
    .exhaustive();
}
