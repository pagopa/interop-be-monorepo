import { EServiceEventEnvelopeV1 } from "pagopa-interop-models";
import { match, P } from "ts-pattern";

export async function handleCatalogMessageV1(
  message: EServiceEventEnvelopeV1
): Promise<void> {
  await match(message)
    .with(
      P.union({ type: "EServiceAdded" }, { type: "ClonedEServiceAdded" }),
      async () => Promise.resolve()
    )
    .with(
      P.union(
        { type: "EServiceUpdated" },
        { type: "EServiceRiskAnalysisAdded" },
        { type: "MovedAttributesFromEserviceToDescriptors" },
        { type: "EServiceRiskAnalysisUpdated" }
      ),
      async () => Promise.resolve()
    )
    .with(
      P.union(
        { type: "EServiceWithDescriptorsDeleted" },
        { type: "EServiceDocumentUpdated" },
        { type: "EServiceDeleted" },
        { type: "EServiceDocumentAdded" },
        { type: "EServiceDocumentDeleted" },
        { type: "EServiceDescriptorAdded" },
        { type: "EServiceDescriptorUpdated" },
        { type: "EServiceRiskAnalysisDeleted" }
      ),
      async () => Promise.resolve()
    )
    .exhaustive();
}
