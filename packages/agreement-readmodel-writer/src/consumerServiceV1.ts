import { match } from "ts-pattern";
import { AgreementCollection } from "pagopa-interop-commons";
import {
  AgreementEventEnvelopeV1,
  toReadModelAgreement,
  fromAgreementDocumentV1,
  fromAgreementV1,
  toReadModelAgreementDocument,
} from "pagopa-interop-models";

export async function handleMessageV1(
  message: AgreementEventEnvelopeV1,
  agreements: AgreementCollection
): Promise<void> {
  await match(message)
    .with({ type: "AgreementAdded" }, async (msg) => {
      await agreements.updateOne(
        {
          "data.id": msg.stream_id,
        },
        {
          $setOnInsert: {
            data: msg.data.agreement
              ? toReadModelAgreement(fromAgreementV1(msg.data.agreement))
              : undefined,
            metadata: {
              version: msg.version,
            },
          },
        },
        { upsert: true }
      );
    })
    .with({ type: "AgreementDeleted" }, async (msg) => {
      await agreements.deleteOne({
        "data.id": msg.stream_id,
        "metadata.version": { $lte: msg.version },
      });
    })
    .with(
      { type: "AgreementUpdated" },
      { type: "AgreementActivated" },
      { type: "AgreementSuspended" },
      { type: "AgreementDeactivated" },
      { type: "VerifiedAttributeUpdated" },
      async (msg) => {
        await agreements.updateOne(
          {
            "data.id": msg.stream_id,
            "metadata.version": { $lte: msg.version },
          },
          {
            $set: {
              data: msg.data.agreement
                ? toReadModelAgreement(fromAgreementV1(msg.data.agreement))
                : undefined,
              metadata: {
                version: msg.version,
              },
            },
          }
        );
      }
    )
    .with({ type: "AgreementConsumerDocumentAdded" }, async (msg) => {
      await agreements.updateOne(
        {
          "data.id": msg.stream_id,
          "metadata.version": { $lte: msg.version },
        },
        {
          $push: {
            "data.consumerDocuments": msg.data.document
              ? toReadModelAgreementDocument(
                  fromAgreementDocumentV1(msg.data.document)
                )
              : undefined,
          },
          $set: {
            metadata: {
              version: msg.version,
            },
          },
        }
      );
    })
    .with({ type: "AgreementConsumerDocumentRemoved" }, async (msg) => {
      await agreements.updateOne(
        {
          "data.id": msg.stream_id,
          "metadata.version": { $lte: msg.version },
        },
        {
          $pull: {
            "data.consumerDocuments": {
              id: msg.data.documentId,
            },
          },
          $set: {
            metadata: {
              version: msg.version,
            },
          },
        }
      );
    })
    .with({ type: "AgreementContractAdded" }, async (msg) => {
      await agreements.updateOne(
        {
          "data.id": msg.stream_id,
          "metadata.version": { $lte: msg.version },
        },
        {
          $set: {
            "data.contract": msg.data.contract
              ? toReadModelAgreementDocument(
                  fromAgreementDocumentV1(msg.data.contract)
                )
              : undefined,
            metadata: {
              version: msg.version,
            },
          },
        }
      );
    })
    .exhaustive();
}
