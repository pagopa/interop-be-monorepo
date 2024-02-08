import { CreateEvent } from "pagopa-interop-commons";
import {
  EService,
  Document,
  Descriptor,
  EServiceTechnologyV2,
  EServiceAttributeV2,
  EServiceAttribute,
  EServiceDescriptorStateV2,
  AgreementApprovalPolicyV2,
  EServiceV2,
  EServiceDocumentV2,
  EServiceDescriptorV2,
  AgreementApprovalPolicy,
  DescriptorState,
  Technology,
  EServiceEvent,
  DescriptorId,
  EServiceDocumentId,
} from "pagopa-interop-models";
import { P, match } from "ts-pattern";

export const toAgreementApprovalPolicyV2 = (
  input: AgreementApprovalPolicy | undefined
): AgreementApprovalPolicyV2 | undefined =>
  match(input)
    .with(P.nullish, () => undefined)
    .with("Manual", () => AgreementApprovalPolicyV2.MANUAL)
    .with("Automatic", () => AgreementApprovalPolicyV2.AUTOMATIC)
    .exhaustive();

export const toEServiceDescriptorStateV2 = (
  input: DescriptorState
): EServiceDescriptorStateV2 =>
  match(input)
    .with("Draft", () => EServiceDescriptorStateV2.DRAFT)
    .with("Suspended", () => EServiceDescriptorStateV2.SUSPENDED)
    .with("Archived", () => EServiceDescriptorStateV2.ARCHIVED)
    .with("Published", () => EServiceDescriptorStateV2.PUBLISHED)
    .with("Deprecated", () => EServiceDescriptorStateV2.DEPRECATED)
    .exhaustive();

export const toEServiceTechnologyV2 = (
  input: Technology
): EServiceTechnologyV2 =>
  match(input)
    .with("Rest", () => EServiceTechnologyV2.REST)
    .with("Soap", () => EServiceTechnologyV2.SOAP)
    .exhaustive();

export const toEServiceAttributeV2 = (
  input: EServiceAttribute[]
): EServiceAttributeV2 => ({
  group: input.map((i) => ({
    id: i.id,
    explicitAttributeVerification: i.explicitAttributeVerification,
  })),
});

export const toDocumentV2 = (input: Document): EServiceDocumentV2 => ({
  ...input,
  uploadDate: input.uploadDate.toISOString(),
});

export const toDescriptorV2 = (input: Descriptor): EServiceDescriptorV2 => ({
  ...input,
  attributes: {
    certified: input.attributes.certified.map(toEServiceAttributeV2),
    declared: input.attributes.declared.map(toEServiceAttributeV2),
    verified: input.attributes.verified.map(toEServiceAttributeV2),
  },
  docs: input.docs.map(toDocumentV2),
  state: toEServiceDescriptorStateV2(input.state),
  interface:
    input.interface != null ? toDocumentV2(input.interface) : undefined,
  agreementApprovalPolicy: toAgreementApprovalPolicyV2(
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

export const toEServiceV2 = (eService: EService): EServiceV2 => ({
  ...eService,
  technology: toEServiceTechnologyV2(eService.technology),
  attributes:
    eService.attributes != null
      ? {
          certified: eService.attributes.certified.map(toEServiceAttributeV2),
          declared: eService.attributes.declared.map(toEServiceAttributeV2),
          verified: eService.attributes.verified.map(toEServiceAttributeV2),
        }
      : undefined,
  descriptors: eService.descriptors.map(toDescriptorV2),
  createdAt: BigInt(eService.createdAt.getTime()),
});

export const toCreateEventEServiceAdded = (
  eService: EService
): CreateEvent<EServiceEvent> => ({
  streamId: eService.id,
  version: 0,
  event: {
    type: "EServiceAdded",
    eventVersion: 2,
    data: { eservice: toEServiceV2(eService) },
  },
});

export const toCreateEventClonedEServiceAdded = (
  sourceDescriptorId: DescriptorId,
  sourceEservice: EService,
  clonedEservice: EService
): CreateEvent<EServiceEvent> => ({
  streamId: clonedEservice.id,
  version: 0,
  event: {
    type: "EServiceCloned",
    eventVersion: 2,
    data: {
      sourceDescriptorId,
      sourceEservice: toEServiceV2(sourceEservice),
      clonedEservice: toEServiceV2(clonedEservice),
    },
  },
});

export const toCreateEventEServiceDocumentAdded = (
  streamId: string,
  version: number,
  {
    descriptorId,
    documentId,
    eservice,
    isInterface,
  }: {
    descriptorId: DescriptorId;
    documentId: EServiceDocumentId;
    eservice: EService;
    isInterface: boolean;
  }
): CreateEvent<EServiceEvent> => ({
  streamId,
  version,
  event: {
    type: isInterface
      ? "EServiceDescriptorInterfaceAdded"
      : "EServiceDescriptorDocumentAdded",
    eventVersion: 2,
    data: {
      descriptorId,
      documentId,
      eservice: toEServiceV2(eservice),
    },
  },
});

export const toCreateEventEServiceDescriptorAdded = (
  streamId: string,
  version: number,
  descriptorId: DescriptorId,
  eservice: EService
): CreateEvent<EServiceEvent> => ({
  streamId,
  version,
  event: {
    type: "EServiceDescriptorAdded",
    eventVersion: 2,
    data: {
      descriptorId,
      eservice: toEServiceV2(eservice),
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
    type: "DraftEServiceUpdated",
    eventVersion: 2,
    data: {
      eservice: toEServiceV2(updatedEService),
    },
  },
});

export const toCreateEventEServiceDocumentUpdated = (
  streamId: string,
  version: number,
  {
    descriptorId,
    documentId,
    eservice,
    isInterface,
  }: {
    descriptorId: DescriptorId;
    documentId: EServiceDocumentId;
    eservice: EService;
    isInterface: boolean;
  }
): CreateEvent<EServiceEvent> => ({
  streamId,
  version,
  event: {
    type: isInterface
      ? "EServiceDescriptorInterfaceUpdated"
      : "EServiceDescriptorDocumentUpdated",
    eventVersion: 2,
    data: {
      descriptorId,
      documentId,
      eservice: toEServiceV2(eservice),
    },
  },
});

export const toCreateEventEServiceDraftDescriptorUpdated = (
  streamId: string,
  version: number,
  descriptorId: DescriptorId,
  eservice: EService
): CreateEvent<EServiceEvent> => ({
  streamId,
  version,
  event: {
    type: "EServiceDraftDescriptorUpdated",
    eventVersion: 2,
    data: {
      descriptorId,
      eservice: toEServiceV2(eservice),
    },
  },
});

export const toCreateEventEServiceDescriptorActivated = (
  streamId: string,
  version: number,
  descriptorId: DescriptorId,
  eservice: EService
): CreateEvent<EServiceEvent> => ({
  streamId,
  version,
  event: {
    type: "EServiceDescriptorActivated",
    eventVersion: 2,
    data: {
      descriptorId,
      eservice: toEServiceV2(eservice),
    },
  },
});

export const toCreateEventEServiceDescriptorArchived = (
  streamId: string,
  version: number,
  descriptorId: DescriptorId,
  eservice: EService
): CreateEvent<EServiceEvent> => ({
  streamId,
  version,
  event: {
    type: "EServiceDescriptorArchived",
    eventVersion: 2,
    data: {
      descriptorId,
      eservice: toEServiceV2(eservice),
    },
  },
});

export const toCreateEventEServiceDescriptorPublished = (
  streamId: string,
  version: number,
  descriptorId: DescriptorId,
  eservice: EService,
  deprecatedDescriptorId?: DescriptorId
): CreateEvent<EServiceEvent> => ({
  streamId,
  version,
  event: {
    type: "EServiceDescriptorPublished",
    eventVersion: 2,
    data: {
      descriptorId,
      deprecatedDescriptorId,
      eservice: toEServiceV2(eservice),
    },
  },
});

export const toCreateEventEServiceDescriptorSuspended = (
  streamId: string,
  version: number,
  descriptorId: DescriptorId,
  eservice: EService
): CreateEvent<EServiceEvent> => ({
  streamId,
  version,
  event: {
    type: "EServiceDescriptorSuspended",
    eventVersion: 2,
    data: {
      descriptorId,
      eservice: toEServiceV2(eservice),
    },
  },
});

export const toCreateEventEServiceDeleted = (
  streamId: string,
  version: number,
  eservice: EService
): CreateEvent<EServiceEvent> => ({
  streamId,
  version,
  event: {
    type: "EServiceDeleted",
    eventVersion: 2,
    data: {
      eserviceId: streamId,
      eservice: toEServiceV2(eservice),
    },
  },
});

export const toCreateEventEServiceDocumentDeleted = (
  streamId: string,
  version: number,
  {
    descriptorId,
    documentId,
    eservice,
    isInterface,
  }: {
    descriptorId: DescriptorId;
    documentId: EServiceDocumentId;
    eservice: EService;
    isInterface: boolean;
  }
): CreateEvent<EServiceEvent> => ({
  streamId,
  version,
  event: {
    type: isInterface
      ? "EServiceDescriptorInterfaceDeleted"
      : "EServiceDescriptorDocumentDeleted",
    eventVersion: 2,
    data: {
      descriptorId,
      documentId,
      eservice: toEServiceV2(eservice),
    },
  },
});

export const toCreateEventEServiceDescriptorDeleted = (
  streamId: string,
  version: number,
  eservice: EService,
  descriptorId: DescriptorId
): CreateEvent<EServiceEvent> => ({
  streamId,
  version,
  event: {
    type: "EServiceDescriptorDeleted",
    eventVersion: 2,
    data: {
      eservice: toEServiceV2(eservice),
      descriptorId,
    },
  },
});
