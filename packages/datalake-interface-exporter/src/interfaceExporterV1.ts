import { FileManager, Logger } from "pagopa-interop-commons";
import {
  descriptorState,
  EServiceEventEnvelopeV1,
  fromDescriptorV1,
  unsafeBrandId,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { EachMessagePayload } from "kafkajs";
import { exportInterface } from "./interfaceExporter.js";

export async function exportInterfaceV1(
  decodedMsg: EServiceEventEnvelopeV1,
  originalPayload: EachMessagePayload,
  fileManager: FileManager,
  logger: Logger
): Promise<void> {
  await match(decodedMsg)
    .with({ type: "EServiceDescriptorUpdated" }, async ({ data }) => {
      if (data.eserviceDescriptor) {
        logger.info(
          `Processing ${decodedMsg.type} message - Partition number: ${originalPayload.partition} - Offset: ${originalPayload.message.offset}`
        );
        const updatedDescriptor = fromDescriptorV1(data.eserviceDescriptor);
        if (updatedDescriptor.state === descriptorState.published) {
          await exportInterface(
            unsafeBrandId(data.eserviceId),
            updatedDescriptor,
            fileManager,
            logger
          );
        }
      }
    })
    .with(
      { type: "EServiceAdded" },
      { type: "ClonedEServiceAdded" },
      { type: "EServiceUpdated" },
      { type: "EServiceWithDescriptorsDeleted" },
      { type: "EServiceDocumentUpdated" },
      { type: "EServiceDeleted" },
      { type: "EServiceDocumentAdded" },
      { type: "EServiceDocumentDeleted" },
      { type: "EServiceDescriptorAdded" },
      { type: "MovedAttributesFromEserviceToDescriptors" },
      { type: "EServiceRiskAnalysisAdded" },
      { type: "EServiceRiskAnalysisUpdated" },
      { type: "EServiceRiskAnalysisDeleted" },
      () => undefined
    )
    .exhaustive();
}
