import { v4 as uuidv4 } from "uuid";
import { EService, Document, Attribute } from "pagopa-interop-models";
import {
  EServiceDescriptor,
  EServiceDescriptorSeed,
  EServiceDocument,
  EServiceSeed,
  convertToDescriptorEServiceEventData,
  convertToDocumentEServiceEventData,
} from "../model/domain/models.js";
import { ApiEServiceDescriptorDocumentSeed } from "../model/types.js";
import {
  apiAgreementApprovalPolicyToAgreementApprovalPolicy,
  apiAttributeToAttribute,
  apiTechnologyToTechnology,
} from "../model/domain/apiConverter.js";
import { CreateEvent, CreateEvent1 } from "./EventRepository.js";

const toEService = (
  streamId: string,
  eServiceSeed: EServiceSeed
): EService => ({
  id: streamId,
  producerId: eServiceSeed.producerId,
  name: eServiceSeed.name,
  description: eServiceSeed.description,
  technology: apiTechnologyToTechnology(eServiceSeed.technology), // TODO map enum case
  attributes: undefined,
  descriptors: [],
  createdAt: new Date(),
});

export const toCreateEventEServiceAdded = (
  eServiceSeed: EServiceSeed
): CreateEvent1 => {
  const streamId = uuidv4();
  return {
    streamId,
    version: 0,
    event: {
      type: "EServiceAdded",
      data: {
        eService: toEService(streamId, eServiceSeed),
      },
    },
  };
};

export const toCreateEventEServiceDocumentItemAdded = (
  eServiceId: string,
  descriptorId: string,
  apiEServiceDescriptorDocumentSeed: ApiEServiceDescriptorDocumentSeed
): CreateEvent1 => {
  const streamId = uuidv4();
  return {
    streamId,
    version: 0,
    event: {
      type: "EServiceDocumentAdded",
      data: {
        eServiceId,
        descriptorId,
        document: {
          id: streamId,
          name: apiEServiceDescriptorDocumentSeed.fileName,
          contentType: apiEServiceDescriptorDocumentSeed.contentType,
          prettyName: apiEServiceDescriptorDocumentSeed.prettyName,
          path: apiEServiceDescriptorDocumentSeed.filePath,
          checksum: apiEServiceDescriptorDocumentSeed.checksum,
          uploadDate: new Date(),
        },
        isInterface: apiEServiceDescriptorDocumentSeed.kind === "INTERFACE",
        serverUrls: apiEServiceDescriptorDocumentSeed.serverUrls,
      },
    },
  };
};

export const toCreateEventEServiceDescriptorAdded = (
  descriptorSeed: EServiceDescriptorSeed,
  descriptorVersion: string
): CreateEvent1 => {
  const streamId = uuidv4();

  const certifiedAttributes = descriptorSeed.attributes.certified
    .map(apiAttributeToAttribute)
    .filter((a): a is Attribute => a !== undefined);

  return {
    streamId,
    version: 0,
    event: {
      type: "EServiceDescriptorAdded",
      data: {
        eServiceId: streamId,
        eServiceDescriptor: {
          id: streamId,
          description: descriptorSeed.description,
          version: descriptorVersion,
          interface: undefined,
          docs: [],
          state: "Draft",
          voucherLifespan: descriptorSeed.voucherLifespan,
          audience: descriptorSeed.audience,
          dailyCallsPerConsumer: descriptorSeed.dailyCallsPerConsumer,
          dailyCallsTotal: descriptorSeed.dailyCallsTotal,
          agreementApprovalPolicy:
            apiAgreementApprovalPolicyToAgreementApprovalPolicy(
              descriptorSeed.agreementApprovalPolicy
            ),
          serverUrls: [],
          publishedAt: undefined,
          suspendedAt: undefined,
          deprecatedAt: undefined,
          archivedAt: undefined,
          createdAt: new Date(),
          attributes: {
            certified: certifiedAttributes,
            declared: [],
            verified: [],
          },
        },
      },
    },
  };
};

export const toCreateEventEServiceUpdated = (
  streamId: string,
  version: number,
  updatedEServiceSeed: EServiceSeed
): CreateEvent1 => ({
  streamId,
  version,
  event: {
    type: "EServiceUpdated",
    data: {
      eService: toEService(streamId, updatedEServiceSeed),
    },
  },
});

export const toCreateEventEServiceDocumentUpdated = ({
  streamId,
  version,
  descriptorId,
  documentId,
  updatedDocument,
  serverUrls,
}: {
  streamId: string;
  version: number;
  descriptorId: string;
  documentId: string;
  updatedDocument: Document;
  serverUrls: string[];
}): CreateEvent1 => ({
  streamId,
  version,
  event: {
    type: "EServiceDocumentUpdated",
    data: {
      eServiceId: streamId,
      descriptorId,
      documentId,
      updatedDocument,
      serverUrls,
    },
  },
});

export const toCreateEventEServiceDeleted = (
  streamId: string,
  version: number
): CreateEvent1 => ({
  streamId,
  version,
  event: {
    type: "EServiceDeleted",
    data: {
      eServiceId: streamId,
    },
  },
});

export const toCreateEventEServiceDocumentDeleted = (
  streamId: string,
  version: number,
  descriptorId: string,
  documentId: string
): CreateEvent1 => ({
  streamId,
  version,
  event: {
    type: "EServiceDocumentDeleted",
    data: {
      eServiceId: streamId,
      descriptorId,
      documentId,
    },
  },
});

// old

export const eserviceSeedToCreateEvent = (
  eserviceSeed: EServiceSeed
): CreateEvent<EService> => {
  const id = uuidv4();
  return {
    streamId: id,
    version: 0,
    type: "EServiceAdded", // TODO: change this value with properly event type definition
    data: {
      ...eserviceSeed,
      technology: apiTechnologyToTechnology(eserviceSeed.technology), // TODO map enum case
      id,
      descriptors: [],
      createdAt: new Date(),
    },
  };
};

export const eserviceDescriptorDocumentSeedToCreateEvent = (
  eServiceId: string,
  descriptorId: string,
  apiEServiceDescriptorDocumentSeed: ApiEServiceDescriptorDocumentSeed
): CreateEvent<EServiceDocument> => ({
  streamId: uuidv4(),
  version: 0,
  type: "DocumentItemAdded", // TODO: change this value with properly event type definition
  data: convertToDocumentEServiceEventData(
    eServiceId,
    descriptorId,
    apiEServiceDescriptorDocumentSeed
  ),
});

export const descriptorSeedToCreateEvent = (
  descriptorId: string,
  descriptorSeed: EServiceDescriptorSeed,
  descriptorVersion: string
): CreateEvent<EServiceDescriptor> => ({
  streamId: uuidv4(),
  version: 0,
  type: "Descriptor created", // TODO: change this value with properly event type definition
  data: convertToDescriptorEServiceEventData(
    descriptorSeed,
    descriptorId,
    descriptorVersion
  ),
});
