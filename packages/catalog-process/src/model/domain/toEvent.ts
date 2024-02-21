import { CreateEvent } from "pagopa-interop-commons";
import {
  EService,
  Document,
  Descriptor,
  EServiceTechnologyV1,
  EServiceAttributeV1,
  EServiceAttribute,
  EServiceDescriptorStateV1,
  AgreementApprovalPolicyV1,
  EServiceV1,
  EServiceDocumentV1,
  EServiceDescriptorV1,
  AgreementApprovalPolicy,
  DescriptorState,
  Technology,
  WithMetadata,
  EServiceEvent,
  DescriptorId,
  EServiceDocumentId,
  EServiceMode,
  EServiceModeV1,
  RiskAnalysis,
  EServiceRiskAnalysisV1,
} from "pagopa-interop-models";
import { P, match } from "ts-pattern";

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

export const toEServiceModeV1 = (input: EServiceMode): EServiceModeV1 =>
  match(input)
    .with("Deliver", () => EServiceModeV1.DELIVER)
    .with("Receive", () => EServiceModeV1.RECEIVE)
    .exhaustive();

export const toEServiceAttributeV1 = (
  input: EServiceAttribute[]
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

export const toRiskAnalysisV1 = (
  input: RiskAnalysis
): EServiceRiskAnalysisV1 => ({
  ...input,
  createdAt: BigInt(input.createdAt.getTime()),
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
  mode: toEServiceModeV1(eService.mode),
  riskAnalysis: eService.riskAnalysis.map(toRiskAnalysisV1),
});

export const toCreateEventEServiceAdded = (
  eService: EService
): CreateEvent<EServiceEvent> => ({
  streamId: eService.id,
  version: 0,
  event: {
    type: "EServiceAdded",
    event_version: 1,
    data: { eService: toEServiceV1(eService) },
  },
});

export const toCreateEventClonedEServiceAdded = (
  eService: EService
): CreateEvent<EServiceEvent> => ({
  streamId: eService.id,
  version: 0,
  event: {
    type: "ClonedEServiceAdded",
    event_version: 1,
    data: {
      eService: toEServiceV1(eService),
    },
  },
});

export const toCreateEventEServiceDocumentAdded = (
  streamId: string,
  version: number,
  descriptorId: DescriptorId,
  {
    newDocument,
    isInterface,
    serverUrls,
  }: { newDocument: Document; isInterface: boolean; serverUrls: string[] }
): CreateEvent<EServiceEvent> => ({
  streamId,
  version,
  event: {
    type: "EServiceDocumentAdded",
    event_version: 1,
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
): CreateEvent<EServiceEvent> => ({
  streamId,
  version,
  event: {
    type: "EServiceDescriptorAdded",
    event_version: 1,
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
): CreateEvent<EServiceEvent> => ({
  streamId,
  version,
  event: {
    type: "EServiceUpdated",
    event_version: 1,
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
  descriptorId: DescriptorId;
  documentId: EServiceDocumentId;
  updatedDocument: Document;
  serverUrls: string[];
}): CreateEvent<EServiceEvent> => ({
  streamId,
  version,
  event: {
    type: "EServiceDocumentUpdated",
    event_version: 1,
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
): CreateEvent<EServiceEvent> => ({
  streamId,
  version,
  event: {
    type: "EServiceDescriptorUpdated",
    event_version: 1,
    data: {
      eServiceId: streamId,
      eServiceDescriptor: toDescriptorV1(descriptor),
    },
  },
});

export const toCreateEventEServiceDeleted = (
  streamId: string,
  version: number
): CreateEvent<EServiceEvent> => ({
  streamId,
  version,
  event: {
    type: "EServiceDeleted",
    event_version: 1,
    data: {
      eServiceId: streamId,
    },
  },
});

export const toCreateEventEServiceDocumentDeleted = (
  streamId: string,
  version: number,
  descriptorId: DescriptorId,
  documentId: EServiceDocumentId
): CreateEvent<EServiceEvent> => ({
  streamId,
  version,
  event: {
    type: "EServiceDocumentDeleted",
    event_version: 1,
    data: {
      eServiceId: streamId,
      descriptorId,
      documentId,
    },
  },
});

export const toCreateEventEServiceWithDescriptorsDeleted = (
  eService: WithMetadata<EService>,
  descriptorId: DescriptorId
): CreateEvent<EServiceEvent> => ({
  streamId: eService.data.id,
  version: eService.metadata.version,
  event: {
    type: "EServiceWithDescriptorsDeleted",
    event_version: 1,
    data: {
      eService: toEServiceV1(eService.data),
      descriptorId,
    },
  },
});
