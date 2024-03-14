import { EServiceCollection, logger } from "pagopa-interop-commons";
import { EServiceEventEnvelopeV2 } from "pagopa-interop-models";
import { match } from "ts-pattern";
import { fromEServiceV2 } from "./model/converterV2.js";
import { toReadModelEService } from "./model/legacy/eserviceAdapter.js";

export async function handleMessageV2(
  message: EServiceEventEnvelopeV2,
  eservices: EServiceCollection
): Promise<void> {
  logger.info(message);

  const eservice = message.data.eservice;

  await match(message)
    .with({ type: "EServiceDeleted" }, async (message) => {
      await eservices.deleteOne({
        "data.id": message.stream_id,
        "metadata.version": { $lt: message.version },
      });
    })
    .with(
      { type: "EServiceAdded" },
      { type: "DraftEServiceUpdated" },
      { type: "EServiceCloned" },
      { type: "EServiceDescriptorAdded" },
      { type: "EServiceDraftDescriptorDeleted" },
      { type: "EServiceDraftDescriptorUpdated" },
      { type: "EServiceDescriptorQuotasUpdated" },
      { type: "EServiceDescriptorActivated" },
      { type: "EServiceDescriptorArchived" },
      { type: "EServiceDescriptorPublished" },
      { type: "EServiceDescriptorSuspended" },
      { type: "EServiceDescriptorInterfaceAdded" },
      { type: "EServiceDescriptorDocumentAdded" },
      { type: "EServiceDescriptorInterfaceUpdated" },
      { type: "EServiceDescriptorDocumentUpdated" },
      { type: "EServiceDescriptorInterfaceDeleted" },
      { type: "EServiceDescriptorDocumentDeleted" },
      { type: "EServiceRiskAnalysisAdded" },
      { type: "EServiceRiskAnalysisUpdated" },
      async (message) =>
        await eservices.updateOne(
          {
            "data.id": message.stream_id,
            "metadata.version": { $lt: message.version },
          },
          {
            $set: {
              data: eservice
                ? toReadModelEService(fromEServiceV2(eservice))
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
