import { match } from "ts-pattern";
import {
  AgreementEventEnvelopeV1,
  fromAgreementV1,
  genericInternalError,
  AgreementId,
  unsafeBrandId,
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
      // await agreements.updateOne(
      //   {
      //     "data.id": msg.stream_id,
      //     "metadata.version": { $lte: msg.version },
      //   },
      //   {
      //     $push: {
      //       "data.consumerDocuments": msg.data.document
      //         ? toReadModelAgreementDocument(
      //             fromAgreementDocumentV1(msg.data.document)
      //           )
      //         : undefined,
      //     },
      //     $set: {
      //       metadata: {
      //         version: msg.version,
      //       },
      //     },
      //   }
      // );
    })
    .with({ type: "AgreementConsumerDocumentRemoved" }, async (msg) => {
      // await agreements.updateOne(
      //   {
      //     "data.id": msg.stream_id,
      //     "metadata.version": { $lte: msg.version },
      //   },
      //   {
      //     $pull: {
      //       "data.consumerDocuments": {
      //         id: msg.data.documentId,
      //       },
      //     },
      //     $set: {
      //       metadata: {
      //         version: msg.version,
      //       },
      //     },
      //   }
      // );
    })
    .with({ type: "AgreementContractAdded" }, async (msg) => {
      // await agreements.updateOne(
      //   {
      //     "data.id": msg.stream_id,
      //     "metadata.version": { $lte: msg.version },
      //   },
      //   {
      //     $set: {
      //       "data.contract": msg.data.contract
      //         ? toReadModelAgreementDocument(
      //             fromAgreementDocumentV1(msg.data.contract)
      //           )
      //         : undefined,
      //       metadata: {
      //         version: msg.version,
      //       },
      //     },
      //   }
      // );
    })
    .exhaustive();
}
