import { match } from "ts-pattern";
import {
  AgreementEventEnvelopeV1,
  fromAgreementV1,
  genericInternalError,
  unsafeBrandId,
  fromAgreementDocumentV1,
} from "pagopa-interop-models";
import { ReadModelService } from "./agreementWriterService.js";

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

        await readModelService.upsertAgreement(
          fromAgreementV1(agreementV1),
          message.version
        );
      }
    )
    .with({ type: "AgreementDeleted" }, async (msg) => {
      await readModelService.deleteAgreementById(
        unsafeBrandId(msg.data.agreementId),
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
        unsafeBrandId(msg.data.agreementId),
        msg.version
      );
    })
    .with({ type: "AgreementConsumerDocumentRemoved" }, async (msg) => {
      await readModelService.deleteConsumerDocument(
        unsafeBrandId(msg.data.agreementId),
        unsafeBrandId(msg.data.documentId),
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
        unsafeBrandId(msg.data.agreementId),
        msg.version
      );
    })
    .exhaustive();
}
