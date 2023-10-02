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
  AgreementApprovalPolicy,
  DescriptorState,
  Technology,
} from "pagopa-interop-models";
import { P, match } from "ts-pattern";
import { WithMetadata } from "../model/domain/models.js";
import { CreateEvent } from "./EventRepository.js";

export const toAgreementApprovalPolicyV1 = (
  input: AgreementApprovalPolicy | undefined
): AgreementApprovalPolicyV1 =>
  match(input)
    .with(P.nullish, () => AgreementApprovalPolicyV1.UNSPECIFIED$)
    .with("Manual", () => AgreementApprovalPolicyV1.MANUAL)
    .with("Automatic", () => AgreementApprovalPolicyV1.AUTOMATIC)
    .exhaustive();

export const toEServiceDescriptorStateV1 = (
  input: DescriptorState
): EServiceDescriptorStateV1 =>
  match(input)
    .with("Draft", () => EServiceDescriptorStateV1.DRAFT)
    .with("Suspended", () => EServiceDescriptorStateV1.SUSPENDED)
    .with("Archived", () => EServiceDescriptorStateV1.ARCHIVED)
    .with("Published", () => EServiceDescriptorStateV1.PUBLISHED)
    .with("Deprecated", () => EServiceDescriptorStateV1.DEPRECATED)
    .exhaustive();

export const toEServiceTechnologyV1 = (
  input: Technology
): EServiceTechnologyV1 =>
  match(input)
    .with("Rest", () => EServiceTechnologyV1.REST)
    .with("Soap", () => EServiceTechnologyV1.SOAP)
    .exhaustive();

export const toEServiceAttributeV1 = (
  input: Attribute[]
): EServiceAttributeV1 => ({
  group: input.map((i) => ({
    id: i.id,
    explicitAttributeVerification: i.explicitAttributeVerification,
  })),
});

export const toDocumentV1 = (input: Document): EServiceDocumentV1 => ({
  ...input,
  uploadDate: input.uploadDate.toISOString(),
});

export const toDescriptorV1 = (input: Descriptor): EServiceDescriptorV1 => ({
  ...input,
  attributes: {
    certified: input.attributes.certified.map(toEServiceAttributeV1),
    declared: input.attributes.declared.map(toEServiceAttributeV1),
    verified: input.attributes.verified.map(toEServiceAttributeV1),
  },
  docs: input.docs.map(toDocumentV1),
  state: toEServiceDescriptorStateV1(input.state),
  interface:
    input.interface != null ? toDocumentV1(input.interface) : undefined,
  agreementApprovalPolicy: toAgreementApprovalPolicyV1(
    input.agreementApprovalPolicy
  ),
  createdAt: BigInt(input.createdAt.getTime()),
  publishedAt: input.publishedAt
    ? BigInt(input.publishedAt.getTime())
    : undefined,
  suspendedAt: input.suspendedAt
    ? BigInt(input.suspendedAt.getTime())
    : undefined,
  deprecatedAt: input.deprecatedAt
    ? BigInt(input.deprecatedAt.getTime())
    : undefined,
  archivedAt: input.archivedAt ? BigInt(input.archivedAt.getTime()) : undefined,
});

export const toEServiceV1 = (eService: EService): EServiceV1 => ({
  ...eService,
  technology: toEServiceTechnologyV1(eService.technology),
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

export const toCreateEventEServiceAdded = (
  eService: EService
): CreateEvent => ({
  streamId: eService.id,
  version: 0,
  event: {
    type: "EServiceAdded",
    data: { eService: toEServiceV1(eService) },
  },
});

export const toCreateEventClonedEServiceAdded = (
  eService: EService
): CreateEvent => ({
  streamId: eService.id,
  version: 0,
  event: {
    type: "ClonedEServiceAdded",
    data: {
      eService: toEServiceV1(eService),
    },
  },
});

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
