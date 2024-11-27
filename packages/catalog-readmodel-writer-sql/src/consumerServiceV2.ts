import { ReadModelRepositorySQL } from "pagopa-interop-commons";
import {
  DescriptorId,
  descriptorState,
  EService,
  EServiceDocumentId,
  EServiceEventEnvelopeV2,
  EServiceId,
  EServiceV2,
  fromEServiceV2,
  genericInternalError,
  RiskAnalysisId,
  unsafeBrandId,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import * as poc from "pagopa-interop-poc-readmodel";

export async function handleMessageV2(
  message: EServiceEventEnvelopeV2,
  readModelRepositorySQL: ReadModelRepositorySQL
): Promise<void> {
  await match(message)
    .with({ type: "EServiceDeleted" }, async (message) => {
      const eserviceId = unsafeBrandId<EServiceId>(message.data.eserviceId);
      poc.deleteEService(eserviceId, readModelRepositorySQL);
    })
    .with(
      { type: "EServiceAdded" },
      { type: "EServiceCloned" },
      { type: "DraftEServiceUpdated" },
      async (message) => {
        const eservice = parseEservice(message.data.eservice);
        await poc.upsertEService(eservice, readModelRepositorySQL);
      }
    )
    .with({ type: "EServiceDescriptorAdded" }, (message) => {
      const eservice = parseEservice(message.data.eservice);
      const descriptorId = unsafeBrandId<DescriptorId>(
        message.data.descriptorId
      );

      const descriptor = eservice.descriptors.find(
        (d) => d.id === descriptorId
      );

      if (!descriptor) {
        throw genericInternalError("");
      }

      poc.addDescriptor(eservice.id, descriptor, readModelRepositorySQL);
    })
    .with({ type: "EServiceDraftDescriptorDeleted" }, async (message) => {
      const descriptorId = unsafeBrandId<DescriptorId>(
        message.data.descriptorId
      );

      await poc.deleteDescriptor(descriptorId, readModelRepositorySQL);
    })
    .with({ type: "EServiceDraftDescriptorUpdated" }, async (message) => {
      const eservice = parseEservice(message.data.eservice);
      const descriptorId = unsafeBrandId<DescriptorId>(
        message.data.descriptorId
      );

      const descriptor = eservice.descriptors.find(
        (d) => d.id === descriptorId
      );

      if (!descriptor) {
        throw genericInternalError("");
      }

      await poc.replaceDescriptor(
        eservice.id,
        descriptor,
        readModelRepositorySQL
      );
    })
    .with(
      { type: "EServiceDescriptorQuotasUpdated" },
      { type: "EServiceDescriptorActivated" },
      { type: "EServiceDescriptorArchived" },
      { type: "EServiceDescriptorSuspended" },
      async (message) => {
        const eservice = parseEservice(message.data.eservice);
        const descriptorId = unsafeBrandId<DescriptorId>(
          message.data.descriptorId
        );

        const descriptor = eservice.descriptors.find(
          (d) => d.id === descriptorId
        );

        if (!descriptor) {
          throw genericInternalError("");
        }

        await poc.updateDescriptor(
          eservice.id,
          descriptor,
          readModelRepositorySQL
        );
      }
    )
    .with({ type: "EServiceDescriptorPublished" }, (message) => {
      const eservice = parseEservice(message.data.eservice);
      const descriptorId = unsafeBrandId<DescriptorId>(
        message.data.descriptorId
      );
      const publishedDescriptor = eservice.descriptors.find(
        (d) => d.id === descriptorId
      );

      if (!publishedDescriptor) {
        throw genericInternalError("");
      }

      // TODO double check this: are we sure the "previous descriptor" (that has the side effect of the publication) is always the n-1?
      const previousDescriptor = eservice.descriptors.find(
        (d) =>
          (parseInt(d.version, 10) ===
            parseInt(publishedDescriptor.version, 10) - 1 &&
            d.state === descriptorState.deprecated) ||
          d.state === descriptorState.archived
      );

      poc.publishDescriptor(
        publishedDescriptor,
        previousDescriptor,
        eservice.id,
        readModelRepositorySQL
      );
    })
    .with({ type: "EServiceDescriptorInterfaceAdded" }, (message) => {
      const eservice = parseEservice(message.data.eservice);
      const descriptorId = unsafeBrandId<DescriptorId>(
        message.data.descriptorId
      );

      const descriptor = eservice.descriptors.find(
        (d) => d.id === descriptorId
      );

      if (!descriptor) {
        throw genericInternalError("");
      }

      poc.addInterface(eservice.id, descriptor, readModelRepositorySQL);
    })
    .with({ type: "EServiceDescriptorDocumentAdded" }, async (message) => {
      const eservice = parseEservice(message.data.eservice);
      const descriptorId = unsafeBrandId<DescriptorId>(
        message.data.descriptorId
      );
      const documentId = unsafeBrandId<EServiceDocumentId>(
        message.data.documentId
      );

      const descriptor = eservice.descriptors.find(
        (d) => d.id === descriptorId
      );

      if (!descriptor) {
        throw genericInternalError("");
      }

      const document = descriptor.docs.find((d) => d.id === documentId);

      if (!document) {
        throw genericInternalError("");
      }

      await poc.addDocument(document, descriptor.id, readModelRepositorySQL);
    })
    .with({ type: "EServiceDescriptorInterfaceUpdated" }, async (message) => {
      const eservice = parseEservice(message.data.eservice);
      const descriptorId = unsafeBrandId<DescriptorId>(
        message.data.descriptorId
      );

      const descriptor = eservice.descriptors.find(
        (d) => d.id === descriptorId
      );

      if (!descriptor) {
        throw genericInternalError("");
      }

      if (!descriptor.interface) {
        throw genericInternalError("");
      }

      await poc.updateDocument(
        descriptor.id,
        descriptor.interface,
        readModelRepositorySQL
      );
    })
    .with({ type: "EServiceDescriptorDocumentUpdated" }, async (message) => {
      const eservice = parseEservice(message.data.eservice);
      const descriptorId = unsafeBrandId<DescriptorId>(
        message.data.descriptorId
      );
      const documentId = unsafeBrandId<EServiceDocumentId>(
        message.data.documentId
      );

      const descriptor = eservice.descriptors.find(
        (d) => d.id === descriptorId
      );

      if (!descriptor) {
        throw genericInternalError("");
      }

      const document = descriptor.docs.find((d) => d.id === documentId);

      if (!document) {
        throw genericInternalError("");
      }

      await poc.updateDocument(descriptor.id, document, readModelRepositorySQL);
    })
    .with({ type: "EServiceDescriptorInterfaceDeleted" }, async (message) => {
      const eservice = parseEservice(message.data.eservice);
      const descriptorId = unsafeBrandId<DescriptorId>(
        message.data.descriptorId
      );
      const interfaceId = unsafeBrandId<EServiceDocumentId>(
        message.data.documentId
      );

      const descriptor = eservice.descriptors.find(
        (d) => d.id === descriptorId
      );

      if (!descriptor) {
        throw genericInternalError("");
      }

      await poc.deleteInterface(
        eservice.id,
        descriptor,
        interfaceId,
        readModelRepositorySQL
      );
    })
    .with({ type: "EServiceDescriptorDocumentDeleted" }, async (message) => {
      const eservice = parseEservice(message.data.eservice);
      const descriptorId = unsafeBrandId<DescriptorId>(
        message.data.descriptorId
      );
      const documentId = unsafeBrandId<EServiceDocumentId>(
        message.data.documentId
      );

      const descriptor = eservice.descriptors.find(
        (d) => d.id === descriptorId
      );

      if (!descriptor) {
        throw genericInternalError("");
      }

      await poc.deleteDocument(documentId, readModelRepositorySQL);
    })
    .with({ type: "EServiceRiskAnalysisAdded" }, async (message) => {
      const eservice = parseEservice(message.data.eservice);
      const riskAnalysisId = unsafeBrandId<RiskAnalysisId>(
        message.data.riskAnalysisId
      );
      const newRiskAnalysis = eservice.riskAnalysis.find(
        (riskAnalysis) => riskAnalysis.id === riskAnalysisId
      );

      if (!newRiskAnalysis) {
        throw genericInternalError("");
      }

      await poc.addRiskAnalysis(
        eservice.id,
        newRiskAnalysis,
        readModelRepositorySQL
      );
    })
    .with({ type: "EServiceRiskAnalysisUpdated" }, async (message) => {
      const eservice = parseEservice(message.data.eservice);
      const riskAnalysisId = unsafeBrandId<RiskAnalysisId>(
        message.data.riskAnalysisId
      );
      const updatedRiskAnalysis = eservice.riskAnalysis.find(
        (riskAnalysis) => riskAnalysis.id === riskAnalysisId
      );

      if (!updatedRiskAnalysis) {
        throw genericInternalError("");
      }

      await poc.updateRiskAnalysis(
        updatedRiskAnalysis,
        eservice.id,
        readModelRepositorySQL
      );
    })
    .with({ type: "EServiceRiskAnalysisDeleted" }, async (message) => {
      const riskAnalysisId = unsafeBrandId<RiskAnalysisId>(
        message.data.riskAnalysisId
      );
      await poc.deleteRiskAnalysis(riskAnalysisId, readModelRepositorySQL);
    })
    .with({ type: "EServiceDescriptionUpdated" }, async (message) => {
      const eservice = parseEservice(message.data.eservice);
      await poc.updateEservice(eservice, readModelRepositorySQL);
    })
    .exhaustive();
}

const parseEservice = (eservice: EServiceV2 | undefined): EService => {
  if (!eservice) {
    throw genericInternalError("Eservice is missing");
  }
  return fromEServiceV2(eservice);
};
