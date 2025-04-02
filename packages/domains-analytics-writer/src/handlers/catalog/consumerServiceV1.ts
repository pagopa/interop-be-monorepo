import { EServiceEventEnvelopeV1 } from "pagopa-interop-models";
import { match, P } from "ts-pattern";

export async function handleCatalogMessageV1(
  message: EServiceEventEnvelopeV1
): Promise<void> {
  await match(message)
    .with({ type: P.union("EServiceAdded", "ClonedEServiceAdded") }, async () =>
      Promise.resolve()
    )
    .with(
      {
        type: P.union(
          "EServiceUpdated",
          "EServiceRiskAnalysisAdded",
          "MovedAttributesFromEserviceToDescriptors",
          "EServiceRiskAnalysisUpdated"
        ),
      },
      async () => Promise.resolve()
    )
    .with(
      {
        type: P.union(
          "EServiceWithDescriptorsDeleted",
          "EServiceDocumentUpdated",
          "EServiceDeleted",
          "EServiceDocumentAdded",
          "EServiceDocumentDeleted",
          "EServiceDescriptorAdded",
          "EServiceDescriptorUpdated",
          "EServiceRiskAnalysisDeleted"
        ),
      },
      async () => Promise.resolve()
    )
    .exhaustive();
}
