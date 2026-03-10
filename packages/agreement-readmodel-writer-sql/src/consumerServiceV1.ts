import { match } from "ts-pattern";
import {
  AgreementEventEnvelopeV1,
  fromAgreementV1,
  unsafeBrandId,
  fromAgreementDocumentV1,
  missingKafkaMessageDataError,
} from "pagopa-interop-models";
import { AgreementWriterService } from "./agreementWriterService.js";

export async function handleMessageV1(
  message: AgreementEventEnvelopeV1,
  agreementWriterService: AgreementWriterService
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
          throw missingKafkaMessageDataError("agreement", message.type);
        }

        await agreementWriterService.upsertAgreement(
          fromAgreementV1(agreementV1),
          message.version
        );
      }
    )
    .with({ type: "AgreementDeleted" }, async (msg) => {
      await agreementWriterService.deleteAgreementById(
        unsafeBrandId(msg.data.agreementId),
        msg.version
      );
    })
    .with({ type: "AgreementConsumerDocumentAdded" }, async (msg) => {
      const consumerDocV1 = msg.data.document;
      if (!consumerDocV1) {
        throw missingKafkaMessageDataError("document", message.type);
      }

      await agreementWriterService.upsertConsumerDocument(
        fromAgreementDocumentV1(consumerDocV1),
        unsafeBrandId(msg.data.agreementId),
        msg.version
      );
    })
    .with({ type: "AgreementConsumerDocumentRemoved" }, async (msg) => {
      await agreementWriterService.deleteConsumerDocument(
        unsafeBrandId(msg.data.agreementId),
        unsafeBrandId(msg.data.documentId),
        msg.version
      );
    })
    .with({ type: "AgreementContractAdded" }, async (msg) => {
      const contractV1 = msg.data.contract;
      if (!contractV1) {
        throw missingKafkaMessageDataError("contract", message.type);
      }

      await agreementWriterService.upsertContractDocument(
        fromAgreementDocumentV1(contractV1),
        unsafeBrandId(msg.data.agreementId),
        msg.version
      );
    })
    .exhaustive();
}
