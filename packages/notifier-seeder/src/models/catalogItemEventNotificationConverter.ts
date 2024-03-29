import {
  EServiceEventEnvelopeV2,
  fromEServiceV2,
  missingKafkaMessageDataError,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { eventV1ConversionError } from "../notifierErrors.js";
import {
  CatalogDescriptorV1Notification,
  CatalogDocumentV1Notification,
  CatalogItemEventNotification,
  CatalogItemV1Notification,
} from "./catalogItemEventNotification.js";
import { toCatalogItemV1 } from "./catalogItemEventNotificationMappers.js";

const getCatalogItem = (
  event: EServiceEventEnvelopeV2
): CatalogItemV1Notification => {
  if (!event.data.eservice) {
    throw missingKafkaMessageDataError("eservice", event.type);
  }
  const eservice = fromEServiceV2(event.data.eservice);
  return toCatalogItemV1(eservice);
};

const getCatalogItemDescriptor = (
  eserviceV1: {
    id: string;
    descriptors: CatalogDescriptorV1Notification[];
  },
  descriptorId: string
): CatalogDescriptorV1Notification => {
  const descriptor = eserviceV1.descriptors.find((d) => d.id === descriptorId);

  if (!descriptor) {
    throw eventV1ConversionError(
      `Expected descriptor ${descriptorId} in eservice during eventV1 conversion`
    );
  }

  return descriptor;
};

const getCatalogItemDocument = (
  descriptor: CatalogDescriptorV1Notification,
  documentId: string
): CatalogDocumentV1Notification => {
  const document = descriptor.docs.find((d) => d.id === documentId);
  if (!document) {
    throw eventV1ConversionError(
      `Expected document ${documentId} in descriptor during eventV1 conversion`
    );
  }

  return document;
};

const getCatalogItemInterface = (
  descriptor: CatalogDescriptorV1Notification,
  interfaceId: string
): CatalogDocumentV1Notification => {
  if (!descriptor?.interface) {
    throw eventV1ConversionError(
      `Expected interface ${interfaceId} in descriptor during eventV1 conversion`
    );
  }

  if (descriptor.interface.id !== interfaceId) {
    throw eventV1ConversionError(
      `Expected Interface with same ID ${interfaceId} in descriptor's interface during eventV1 conversion`
    );
  }

  return descriptor.interface;
};

export const toCatalogItemEventNotification = (
  event: EServiceEventEnvelopeV2
): CatalogItemEventNotification =>
  match(event)
    .with(
      { type: "EServiceAdded" }, // CatalogItemV1AddedV1
      { type: "EServiceCloned" }, // ClonedCatalogItemV1AddedV1
      { type: "DraftEServiceUpdated" }, // CatalogItemV1UpdatedV1
      (e) => ({
        catalogItem: getCatalogItem(e),
      })
    )
    .with(
      { type: "EServiceDeleted" }, // CatalogItemDeletedV1
      (e) => ({
        catalogItemId: e.data.eserviceId,
      })
    )
    .with(
      { type: "EServiceDescriptorAdded" }, // CatelogItemDescriptorItemAdded
      { type: "EServiceDraftDescriptorUpdated" }, // CatalogItemDescriptorUpdatedV1
      { type: "EServiceDescriptorActivated" }, // CatalogItemDescriptorUpdatedV1
      { type: "EServiceDescriptorArchived" }, // CatalogItemDescriptorUpdatedV1
      { type: "EServiceDescriptorPublished" }, // CatalogItemDescriptorUpdatedV1
      { type: "EServiceDescriptorSuspended" }, // CatalogItemDescriptorUpdatedV1
      { type: "EServiceDescriptorQuotasUpdated" },
      (e) => {
        const catalogItem = getCatalogItem(e);
        const catalogItemDescriptor = getCatalogItemDescriptor(
          catalogItem,
          e.data.descriptorId
        );

        return {
          eServiceId: catalogItem.id,
          catalogDescriptor: catalogItemDescriptor,
        };
      }
    )
    .with(
      { type: "EServiceDraftDescriptorDeleted" }, // CatalogItemWithDescriptorsDeletedV1
      (e) => ({
        catalogItem: getCatalogItem(e),
        descriptorId: e.data.descriptorId,
      })
    )
    .with(
      { type: "EServiceDescriptorDocumentAdded" }, // CatalogItemDocumentAddedV1
      (e) => {
        const catalogItem = getCatalogItem(e);
        const catalogItemDescriptor = getCatalogItemDescriptor(
          catalogItem,
          e.data.descriptorId
        );
        const catalogItemDocument = getCatalogItemDocument(
          catalogItemDescriptor,
          e.data.documentId
        );

        return {
          eServiceId: catalogItem.id,
          descriptorId: catalogItemDescriptor.id,
          document: catalogItemDocument,
          isInterface: false,
          serverUrls: catalogItemDescriptor.serverUrls,
        };
      }
    )
    .with(
      { type: "EServiceDescriptorInterfaceAdded" }, // CatalogItemDocumentAddedV1
      (e) => {
        const catalogItem = getCatalogItem(e);
        const catalogItemDescriptor = getCatalogItemDescriptor(
          catalogItem,
          e.data.descriptorId
        );
        const catalogItemInterface = getCatalogItemInterface(
          catalogItemDescriptor,
          e.data.documentId
        );

        return {
          eServiceId: catalogItem.id,
          descriptorId: catalogItemDescriptor.id,
          document: catalogItemInterface,
          isInterface: true,
          serverUrls: catalogItemDescriptor.serverUrls,
        };
      }
    )
    .with(
      { type: "EServiceDescriptorDocumentDeleted" }, // CatalogItemDocumentDeletedV1
      { type: "EServiceDescriptorInterfaceDeleted" }, // CatalogItemDocumentDeletedV1
      (e) => {
        if (!e.data.eservice) {
          throw missingKafkaMessageDataError("eservice", e.type);
        }

        return {
          eserviceId: e.data.eservice.id,
          descriptorId: e.data.descriptorId,
          documentId: e.data.documentId,
        };
      }
    )
    .with(
      { type: "EServiceDescriptorInterfaceUpdated" }, // CatalogItemDocumentUpdatedV1
      (e) => {
        const eserviceV1 = getCatalogItem(e);
        const descriptorV1 = getCatalogItemDescriptor(
          eserviceV1,
          e.data.descriptorId
        );
        const interfaceV1 = getCatalogItemInterface(
          descriptorV1,
          e.data.documentId
        );

        return {
          eServiceId: eserviceV1.id,
          descriptorId: descriptorV1.id,
          documentId: interfaceV1.id,
          updatedDocument: interfaceV1,
          serverUrls: descriptorV1.serverUrls,
        };
      }
    )
    .with(
      { type: "EServiceDescriptorDocumentUpdated" }, // CatalogItemDocumentUpdatedV1
      (e) => {
        const eserviceV1 = getCatalogItem(e);
        const descriptorV1 = getCatalogItemDescriptor(
          eserviceV1,
          e.data.descriptorId
        );
        const documentV1 = getCatalogItemDocument(
          descriptorV1,
          e.data.documentId
        );

        return {
          eserviceId: eserviceV1.id,
          descriptorId: descriptorV1.id,
          documentId: documentV1.id,
          updatedDocument: documentV1,
          serverUrls: descriptorV1.serverUrls,
        };
      }
    )
    .with(
      { type: "EServiceRiskAnalysisAdded" }, // CatalogItemRiskAnalysisAddedV1
      { type: "EServiceRiskAnalysisDeleted" }, // CatalogItemRiskAnalysisDeletedV1
      { type: "EServiceRiskAnalysisUpdated" }, // CatalogItemRiskAnalysisUpdatedV1
      (e) => ({
        catalogItem: getCatalogItem(e),
        catalogRiskAnalysisId: e.data.riskAnalysisId,
      })
    )
    .exhaustive();
