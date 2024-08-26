import { EServiceCollection } from "pagopa-interop-commons";
import { match } from "ts-pattern";
import { EServiceEventEnvelopeV1 } from "pagopa-interop-models";

export async function handleMessageV1(
  message: EServiceEventEnvelopeV1,
  _eservices: EServiceCollection // TO DO dynamoDB table
): Promise<void> {
  await match(message)
    .with(
      { type: "EServiceAdded" },
      { type: "ClonedEServiceAdded" },
      { type: "EServiceUpdated" },
      { type: "EServiceRiskAnalysisAdded" },
      { type: "MovedAttributesFromEserviceToDescriptors" },
      { type: "EServiceRiskAnalysisUpdated" },
      { type: "EServiceWithDescriptorsDeleted" },
      { type: "EServiceDocumentUpdated" },
      { type: "EServiceDeleted" },
      { type: "EServiceDocumentAdded" },
      { type: "EServiceDocumentDeleted" },
      { type: "EServiceDescriptorAdded" },
      { type: "EServiceDescriptorUpdated" },
      { type: "EServiceRiskAnalysisDeleted" },
      () => Promise.resolve()
    )
    .exhaustive();
}
