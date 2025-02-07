import { EServiceEventEnvelopeV1 } from "pagopa-interop-models";
import { match } from "ts-pattern";

export async function handleCatalogMessageV1(
  message: EServiceEventEnvelopeV1
): Promise<void> {
  await match(message)
    .with(
      { type: "EServiceAdded" },
      { type: "ClonedEServiceAdded" },
      async () => Promise.resolve()
    )
    .with(
      { type: "EServiceUpdated" },
      { type: "EServiceRiskAnalysisAdded" },
      { type: "MovedAttributesFromEserviceToDescriptors" },
      { type: "EServiceRiskAnalysisUpdated" },
      async () => Promise.resolve()
    )
    .with({ type: "EServiceWithDescriptorsDeleted" }, async () =>
      Promise.resolve()
    )
    .with({ type: "EServiceDocumentUpdated" }, async () => Promise.resolve())
    .with({ type: "EServiceDeleted" }, async () => Promise.resolve())
    .with({ type: "EServiceDocumentAdded" }, async () => Promise.resolve())
    .with({ type: "EServiceDocumentDeleted" }, async () => Promise.resolve())
    .with({ type: "EServiceDescriptorAdded" }, async () => Promise.resolve())
    .with({ type: "EServiceDescriptorUpdated" }, async () => Promise.resolve())
    .with({ type: "EServiceRiskAnalysisDeleted" }, async () =>
      Promise.resolve()
    )
    .exhaustive();
}
