import { EService, EServiceEventEnvelopeV1 } from "pagopa-interop-models";
import { match, P } from "ts-pattern";
import { catalogServiceBuilder } from "../../service/catalogService.js";
import { DBContext } from "../../db/db.js";

export async function handleCatalogMessageV1(
  message: EServiceEventEnvelopeV1,
  dbContext: DBContext
): Promise<void> {
  const catalogService = catalogServiceBuilder(dbContext);

  await match(message)
    .with(
      {
        type: P.union(
          "EServiceAdded",
          "ClonedEServiceAdded",
          "EServiceUpdated",
          "EServiceRiskAnalysisAdded",
          "MovedAttributesFromEserviceToDescriptors",
          "EServiceRiskAnalysisUpdated"
        ),
      },
      async (msg) => {
        const eservice = EService.parse(msg.data.eservice);
        await catalogService.upsertEService(eservice, msg.event_version);
      }
    )
    .with({ type: "EServiceDeleted" }, async (msg) => {
      await catalogService.deleteEService(msg.data.eserviceId);
    })
    .with({ type: "EServiceWithDescriptorsDeleted" }, async (msg) => {
      await catalogService.deleteDescriptor(msg.data.descriptorId);
    })
    .with(
      { type: P.union("EServiceDocumentUpdated", "EServiceDocumentAdded") },
      async (msg) => {
        await catalogService.upsertEServiceDocument(msg.data.descriptorId);
      }
    )
    .with({ type: "EServiceDocumentDeleted" }, async (msg) => {
      await catalogService.deleteEServiceDocument(msg.data.descriptorId);
    })
    .with({ type: "EServiceRiskAnalysisDeleted" }, async (msg) => {
      await catalogService.deleteEserviceRiskAnalysis(msg.data.riskAnalysisId);
    })
    .with(
      { type: P.union("EServiceDescriptorAdded", "EServiceDescriptorUpdated") },
      async (msg) => {
        await catalogService.upsertEServiceDescriptor({
          ...msg.data.eserviceDescriptor,
          eserviceId: msg.data.eserviceId,
        });
      }
    )
    .exhaustive();
}
