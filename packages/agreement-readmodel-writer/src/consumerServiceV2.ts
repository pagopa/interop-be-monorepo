import { AgreementCollection } from "pagopa-interop-commons";
import {
  AgreementEventEnvelopeV2,
  fromAgreementV2,
  toReadModelAgreement,
} from "pagopa-interop-models";
import { match } from "ts-pattern";

export async function handleMessageV2(
  message: AgreementEventEnvelopeV2,
  agreements: AgreementCollection
): Promise<void> {
  const agreement = message.data.agreement;

  await match(message)
    .with({ type: "AgreementDeleted" }, async (message) => {
      await agreements.deleteOne({
        "data.id": message.stream_id,
        "metadata.version": { $lt: message.version },
      });
    })
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
      async (message) =>
        await agreements.updateOne(
          {
            "data.id": message.stream_id,
            "metadata.version": { $lt: message.version },
          },
          {
            $set: {
              data: agreement
                ? toReadModelAgreement(fromAgreementV2(agreement))
                : undefined,
              metadata: {
                version: message.version,
              },
            },
          },
          { upsert: true }
        )
    )
    .exhaustive();
}
