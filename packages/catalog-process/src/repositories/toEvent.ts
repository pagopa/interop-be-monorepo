import { v4 as uuidv4 } from "uuid";
import {
  EService,
  Document,
  Descriptor,
  EServiceTechnologyV1,
  EServiceAttributeV1,
  Attribute,
  EServiceDescriptorStateV1,
  AgreementApprovalPolicyV1,
  EServiceV1,
  EServiceDocumentV1,
  EServiceDescriptorV1,
} from "pagopa-interop-models";
import { P, match } from "ts-pattern";
import { WithMetadata } from "../model/domain/models.js";
import { CreateEvent } from "./EventRepository.js";

const toEServiceAttributeV1 = (a: Attribute): EServiceAttributeV1 =>
  match<Attribute, EServiceAttributeV1>(a)
    .with(
      {
        id: P.not(P.nullish),
      },
      ({ id }) => ({ id, group: [] })
    )
    .with({ ids: P.not(P.nullish) }, ({ ids }) => ({
      group: ids,
    }))
    .otherwise(() => ({
      id: undefined,
      group: [],
    }));

const toDocumentV1 = (doc: Document): EServiceDocumentV1 => ({
  ...doc,
  uploadDate: doc.uploadDate.toISOString(),
});

const toDescriptorV1 = (d: Descriptor): EServiceDescriptorV1 => ({
  ...d,
  attributes:
    d.attributes != null
      ? {
          certified: d.attributes.certified.map(toEServiceAttributeV1),
          declared: d.attributes.declared.map(toEServiceAttributeV1),
          verified: d.attributes.verified.map(toEServiceAttributeV1),
        }
      : undefined,
  docs: d.docs.map(toDocumentV1),
  state: match(d.state)
    .with("Draft", () => EServiceDescriptorStateV1.DRAFT)
    .with("Suspended", () => EServiceDescriptorStateV1.SUSPENDED)
    .with("Archived", () => EServiceDescriptorStateV1.ARCHIVED)
    .with("Published", () => EServiceDescriptorStateV1.PUBLISHED)
    .with("Deprecated", () => EServiceDescriptorStateV1.DEPRECATED)
    .exhaustive(),
  interface:
    d.interface != null
      ? {
          ...d.interface,
          uploadDate: d.interface.uploadDate.toISOString(),
        }
      : undefined,
  agreementApprovalPolicy: match(d.agreementApprovalPolicy)
    .with(P.nullish, () => AgreementApprovalPolicyV1.UNSPECIFIED$)
    .with("Manual", () => AgreementApprovalPolicyV1.MANUAL)
    .with("Automatic", () => AgreementApprovalPolicyV1.AUTOMATIC)
    .exhaustive(),
  createdAt: BigInt(d.createdAt.getTime()),
  publishedAt: d.publishedAt ? BigInt(d.publishedAt.getTime()) : undefined,
  suspendedAt: d.suspendedAt ? BigInt(d.suspendedAt.getTime()) : undefined,
  deprecatedAt: d.deprecatedAt ? BigInt(d.deprecatedAt.getTime()) : undefined,
  archivedAt: d.archivedAt ? BigInt(d.archivedAt.getTime()) : undefined,
});

const toEServiceV1 = (eService: EService): EServiceV1 => ({
  ...eService,
  technology: match(eService.technology)
    .with("Rest", () => EServiceTechnologyV1.REST)
    .with("Soap", () => EServiceTechnologyV1.SOAP)
    .exhaustive(),
  attributes:
    eService.attributes != null
      ? {
          certified: eService.attributes.certified.map(toEServiceAttributeV1),
          declared: eService.attributes.declared.map(toEServiceAttributeV1),
          verified: eService.attributes.verified.map(toEServiceAttributeV1),
        }
      : undefined,
  descriptors: eService.descriptors.map(toDescriptorV1),
  createdAt: BigInt(eService.createdAt.getTime()),
});

export const toCreateEventEServiceAdded = (eService: EService): CreateEvent => {
  const streamId = uuidv4();
  return {
    streamId,
    version: 0,
    event: {
      type: "EServiceAdded",
      data: { eService: toEServiceV1(eService) },
    },
  };
};

export const toCreateEventClonedEServiceAdded = (
  eService: EService
): CreateEvent => {
  const streamId = uuidv4();
  return {
    streamId,
    version: 0,
    event: {
      type: "ClonedEServiceAdded",
      data: {
        eService: toEServiceV1(eService),
      },
    },
  };
};

export const toCreateEventEServiceDocumentAdded = (
  streamId: string,
  version: number,
  descriptorId: string,
  {
    newDocument,
    isInterface,
    serverUrls,
  }: { newDocument: Document; isInterface: boolean; serverUrls: string[] }
): CreateEvent => ({
  streamId,
  version,
  event: {
    type: "EServiceDocumentAdded",
    data: {
      eServiceId: streamId,
      descriptorId,
      document: toDocumentV1(newDocument),
      isInterface,
      serverUrls,
    },
  },
});

export const toCreateEventEServiceDescriptorAdded = (
  streamId: string,
  version: number,
  newDescriptor: Descriptor
): CreateEvent => ({
  streamId,
  version,
  event: {
    type: "EServiceDescriptorAdded",
    data: {
      eServiceId: streamId,
      eServiceDescriptor: toDescriptorV1(newDescriptor),
    },
  },
});

export const toCreateEventEServiceUpdated = (
  streamId: string,
  version: number,
  updatedEService: EService
): CreateEvent => ({
  streamId,
  version,
  event: {
    type: "EServiceUpdated",
    data: {
      eService: toEServiceV1(updatedEService),
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
}): CreateEvent => ({
  streamId,
  version,
  event: {
    type: "EServiceDocumentUpdated",
    data: {
      eServiceId: streamId,
      descriptorId,
      documentId,
      updatedDocument: toDocumentV1(updatedDocument),
      serverUrls,
    },
  },
});

export const toCreateEventEServiceDescriptorUpdated = (
  streamId: string,
  version: number,
  descriptor: Descriptor
): CreateEvent => ({
  streamId,
  version,
  event: {
    type: "EServiceDescriptorUpdated",
    data: {
      eServiceId: streamId,
      eServiceDescriptor: toDescriptorV1(descriptor),
    },
  },
});

export const toCreateEventEServiceDeleted = (
  streamId: string,
  version: number
): CreateEvent => ({
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
): CreateEvent => ({
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

export const toCreateEventEServiceWithDescriptorsDeleted = (
  eService: WithMetadata<EService>,
  descriptorId: string
): CreateEvent => ({
  streamId: eService.data.id,
  version: eService.metadata.version,
  event: {
    type: "EServiceWithDescriptorsDeleted",
    data: {
      eService: toEServiceV1(eService.data),
      descriptorId,
    },
  },
});
