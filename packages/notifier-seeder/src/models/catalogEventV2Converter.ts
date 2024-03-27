import {
  EServiceDescriptorV1,
  EServiceDocumentV1,
  EServiceEventEnvelopeV2,
  EServiceEventV1,
  EServiceV1,
  fromEServiceV2,
  missingKafkaMessageDataError,
  toEServiceV1,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { eventV1ConversionError } from "../notifierErrors.js";

const getEserviceV1 = (event: EServiceEventEnvelopeV2): EServiceV1 => {
  if (!event.data.eservice) {
    throw missingKafkaMessageDataError("eservice", event.type);
  }
  const eservice = fromEServiceV2(event.data.eservice);
  return toEServiceV1(eservice);
};

const getDescriptorV1 = (
  eserviceV1: EServiceV1,
  descriptorId: string
): EServiceDescriptorV1 => {
  const descriptor = eserviceV1.descriptors.find((d) => d.id === descriptorId);

  if (!descriptor) {
    throw eventV1ConversionError(
      `Expected descriptor ${descriptorId} in eservice during eventV1 conversion`
    );
  }

  return descriptor;
};

const getDocumentV1 = (
  descriptor: EServiceDescriptorV1,
  documentId: string
): EServiceDocumentV1 => {
  const document = descriptor.docs.find((d) => d.id === documentId);
  if (!document) {
    throw eventV1ConversionError(
      `Expected document ${documentId} in descriptor during eventV1 conversion`
    );
  }

  return document;
};

const getInterfaceV1 = (
  descriptor: EServiceDescriptorV1,
  interfaceId: string
): EServiceDocumentV1 => {
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

export const convertToEserviceV1 = (
  event: EServiceEventEnvelopeV2
): EServiceEventV1["data"] =>
  match(event)
    .with(
      { type: "EServiceAdded" },
      { type: "EServiceCloned" },
      { type: "DraftEServiceUpdated" },
      (e) => ({
        eservice: getEserviceV1(e),
      })
    )
    .with({ type: "EServiceDeleted" }, (e) => ({
      eserviceId: e.data.eserviceId,
    }))
    .with(
      { type: "EServiceDraftDescriptorUpdated" },
      { type: "EServiceDescriptorActivated" },
      { type: "EServiceDescriptorArchived" },
      { type: "EServiceDescriptorAdded" },
      { type: "EServiceDescriptorPublished" },
      { type: "EServiceDescriptorSuspended" },
      { type: "EServiceDescriptorQuotasUpdated" },
      (e) => {
        const eserviceV1 = getEserviceV1(e);
        const descriptorV1 = getDescriptorV1(eserviceV1, e.data.descriptorId);

        return {
          eserviceId: eserviceV1.id,
          eserviceDescriptor: descriptorV1,
        };
      }
    )
    .with({ type: "EServiceDraftDescriptorDeleted" }, (e) => ({
      eservice: getEserviceV1(e),
      descriptorId: e.data.descriptorId,
    }))
    .with({ type: "EServiceDescriptorDocumentAdded" }, (e) => {
      const eserviceV1 = getEserviceV1(e);
      const descriptorV1 = getDescriptorV1(eserviceV1, e.data.descriptorId);
      const documentV1 = getDocumentV1(descriptorV1, e.data.documentId);

      return {
        eserviceId: eserviceV1.id,
        descriptorId: descriptorV1.id,
        document: documentV1,
        isInterface: false,
        serverUrls: descriptorV1.serverUrls,
      };
    })
    .with({ type: "EServiceDescriptorInterfaceAdded" }, (e) => {
      const eserviceV1 = getEserviceV1(e);
      const descriptorV1 = getDescriptorV1(eserviceV1, e.data.descriptorId);
      const interfaceV1 = getInterfaceV1(descriptorV1, e.data.documentId);

      return {
        eserviceId: eserviceV1.id,
        descriptorId: descriptorV1.id,
        document: interfaceV1,
        isInterface: true,
        serverUrls: descriptorV1.serverUrls,
      };
    })
    .with(
      { type: "EServiceDescriptorDocumentDeleted" },
      { type: "EServiceDescriptorInterfaceDeleted" },
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
    .with({ type: "EServiceDescriptorInterfaceUpdated" }, (e) => {
      const eserviceV1 = getEserviceV1(e);
      const descriptorV1 = getDescriptorV1(eserviceV1, e.data.descriptorId);
      const interfaceV1 = getInterfaceV1(descriptorV1, e.data.documentId);

      return {
        eserviceId: eserviceV1.id,
        descriptorId: descriptorV1.id,
        documentId: interfaceV1.id,
        updatedDocument: interfaceV1,
        serverUrls: descriptorV1.serverUrls,
      };
    })
    .with({ type: "EServiceDescriptorDocumentUpdated" }, (e) => {
      const eserviceV1 = getEserviceV1(e);
      const descriptorV1 = getDescriptorV1(eserviceV1, e.data.descriptorId);
      const documentV1 = getDocumentV1(descriptorV1, e.data.documentId);

      return {
        eserviceId: eserviceV1.id,
        descriptorId: descriptorV1.id,
        documentId: documentV1.id,
        updatedDocument: documentV1,
        serverUrls: descriptorV1.serverUrls,
      };
    })
    .with(
      { type: "EServiceRiskAnalysisAdded" },
      { type: "EServiceRiskAnalysisDeleted" },
      { type: "EServiceRiskAnalysisUpdated" },
      (e) => ({
        eservice: getEserviceV1(e),
        riskAnalysisId: e.data.riskAnalysisId,
      })
    )
    .exhaustive();
