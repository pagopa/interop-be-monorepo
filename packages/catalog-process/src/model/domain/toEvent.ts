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
  EServiceMode,
  RiskAnalysis,
  EServiceRiskAnalysisV1,
  EServiceModeV2,
  RiskAnalysisId,
} from "pagopa-interop-models";
import { P, match } from "ts-pattern";

export const toAgreementApprovalPolicyV2 = (
  input: AgreementApprovalPolicy | undefined
): AgreementApprovalPolicyV2 =>
  match(input)
    .with(P.nullish, () => AgreementApprovalPolicyV2.AUTOMATIC)
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

export const toEServiceModeV2 = (input: EServiceMode): EServiceModeV2 =>
  match(input)
    .with("Deliver", () => EServiceModeV2.DELIVER)
    .with("Receive", () => EServiceModeV2.RECEIVE)
    .exhaustive();

export const toEServiceAttributeV2 = (
  input: EServiceAttribute[]
): EServiceAttributeV2 => ({
  values: input.map((i) => ({
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
  version: BigInt(input.version),
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

export const toRiskAnalysisV2 = (
  input: RiskAnalysis
): EServiceRiskAnalysisV1 => ({
  ...input,
  createdAt: BigInt(input.createdAt.getTime()),
});

export const toEServiceV2 = (eservice: EService): EServiceV2 => ({
  ...eservice,
  technology: toEServiceTechnologyV2(eservice.technology),
  descriptors: eservice.descriptors.map(toDescriptorV2),
  createdAt: BigInt(eservice.createdAt.getTime()),
  mode: toEServiceModeV2(eservice.mode),
  riskAnalysis: eservice.riskAnalysis.map(toRiskAnalysisV2),
});

export const toCreateEventEServiceAdded = (
  eservice: EService,
  correlationId: string
): CreateEvent<EServiceEvent> => ({
  streamId: eservice.id,
  version: 0,
  event: {
    type: "EServiceAdded",
    event_version: 2,
    data: { eservice: toEServiceV2(eservice) },
  },
  correlationId,
});

export const toCreateEventClonedEServiceAdded = (
  sourceDescriptorId: DescriptorId,
  sourceEservice: EService,
  clonedEservice: EService,
  correlationId: string
): CreateEvent<EServiceEvent> => ({
  streamId: clonedEservice.id,
  version: 0,
  event: {
    type: "EServiceCloned",
    event_version: 2,
    data: {
      sourceDescriptorId,
      sourceEservice: toEServiceV2(sourceEservice),
      eservice: toEServiceV2(clonedEservice),
    },
  },
  correlationId,
});

export const toCreateEventEServiceInterfaceAdded = (
  streamId: string,
  version: number,
  {
    descriptorId,
    documentId,
    eservice,
  }: {
    descriptorId: DescriptorId;
    documentId: EServiceDocumentId;
    eservice: EService;
  },
  correlationId: string
): CreateEvent<EServiceEvent> => ({
  streamId,
  version,
  event: {
    type: "EServiceDescriptorInterfaceAdded",
    event_version: 2,
    data: {
      descriptorId,
      documentId,
      eservice: toEServiceV2(eservice),
    },
  },
  correlationId,
});

export const toCreateEventEServiceDocumentAdded = (
  streamId: string,
  version: number,
  {
    descriptorId,
    documentId,
    eservice,
  }: {
    descriptorId: DescriptorId;
    documentId: EServiceDocumentId;
    eservice: EService;
  },
  correlationId: string
): CreateEvent<EServiceEvent> => ({
  streamId,
  version,
  event: {
    type: "EServiceDescriptorDocumentAdded",
    event_version: 2,
    data: {
      descriptorId,
      documentId,
      eservice: toEServiceV2(eservice),
    },
  },
  correlationId,
});

export const toCreateEventEServiceDescriptorAdded = (
  streamId: string,
  version: number,
  descriptorId: DescriptorId,
  eservice: EService,
  correlationId: string
): CreateEvent<EServiceEvent> => ({
  streamId,
  version,
  event: {
    type: "EServiceDescriptorAdded",
    event_version: 2,
    data: {
      descriptorId,
      eservice: toEServiceV2(eservice),
    },
  },
  correlationId,
});

export const toCreateEventEServiceUpdated = (
  streamId: string,
  version: number,
  updatedEService: EService,
  correlationId: string
): CreateEvent<EServiceEvent> => ({
  streamId,
  version,
  event: {
    type: "DraftEServiceUpdated",
    event_version: 2,
    data: {
      eservice: toEServiceV2(updatedEService),
    },
  },
  correlationId,
});

export const toCreateEventEServiceInterfaceUpdated = (
  streamId: string,
  version: number,
  {
    descriptorId,
    documentId,
    eservice,
  }: {
    descriptorId: DescriptorId;
    documentId: EServiceDocumentId;
    eservice: EService;
  },
  correlationId: string
): CreateEvent<EServiceEvent> => ({
  streamId,
  version,
  event: {
    type: "EServiceDescriptorInterfaceUpdated",
    event_version: 2,
    data: {
      descriptorId,
      documentId,
      eservice: toEServiceV2(eservice),
    },
  },
  correlationId,
});

export const toCreateEventEServiceDocumentUpdated = (
  streamId: string,
  version: number,
  {
    descriptorId,
    documentId,
    eservice,
  }: {
    descriptorId: DescriptorId;
    documentId: EServiceDocumentId;
    eservice: EService;
  },
  correlationId: string
): CreateEvent<EServiceEvent> => ({
  streamId,
  version,
  event: {
    type: "EServiceDescriptorDocumentUpdated",
    event_version: 2,
    data: {
      descriptorId,
      documentId,
      eservice: toEServiceV2(eservice),
    },
  },
  correlationId,
});

export const toCreateEventEServiceDraftDescriptorUpdated = (
  streamId: string,
  version: number,
  descriptorId: DescriptorId,
  eservice: EService,
  correlationId: string
): CreateEvent<EServiceEvent> => ({
  streamId,
  version,
  event: {
    type: "EServiceDraftDescriptorUpdated",
    event_version: 2,
    data: {
      descriptorId,
      eservice: toEServiceV2(eservice),
    },
  },
  correlationId,
});

export const toCreateEventEServiceDescriptorQuotasUpdated = (
  streamId: string,
  version: number,
  descriptorId: DescriptorId,
  eservice: EService
): CreateEvent<EServiceEvent> => ({
  streamId,
  version,
  event: {
    type: "EServiceDescriptorQuotasUpdated",
    event_version: 2,
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
  eservice: EService,
  correlationId: string
): CreateEvent<EServiceEvent> => ({
  streamId,
  version,
  event: {
    type: "EServiceDescriptorActivated",
    event_version: 2,
    data: {
      descriptorId,
      eservice: toEServiceV2(eservice),
    },
  },
  correlationId,
});

export const toCreateEventEServiceDescriptorArchived = (
  streamId: string,
  version: number,
  descriptorId: DescriptorId,
  eservice: EService,
  correlationId: string
): CreateEvent<EServiceEvent> => ({
  streamId,
  version,
  event: {
    type: "EServiceDescriptorArchived",
    event_version: 2,
    data: {
      descriptorId,
      eservice: toEServiceV2(eservice),
    },
  },
  correlationId,
});

export const toCreateEventEServiceDescriptorPublished = (
  streamId: string,
  version: number,
  descriptorId: DescriptorId,
  eservice: EService,
  correlationId: string
): CreateEvent<EServiceEvent> => ({
  streamId,
  version,
  event: {
    type: "EServiceDescriptorPublished",
    event_version: 2,
    data: {
      descriptorId,
      eservice: toEServiceV2(eservice),
    },
  },
  correlationId,
});

export const toCreateEventEServiceDescriptorSuspended = (
  streamId: string,
  version: number,
  descriptorId: DescriptorId,
  eservice: EService,
  correlationId: string
): CreateEvent<EServiceEvent> => ({
  streamId,
  version,
  event: {
    type: "EServiceDescriptorSuspended",
    event_version: 2,
    data: {
      descriptorId,
      eservice: toEServiceV2(eservice),
    },
  },
  correlationId,
});

export const toCreateEventEServiceDeleted = (
  streamId: string,
  version: number,
  eservice: EService,
  correlationId: string
): CreateEvent<EServiceEvent> => ({
  streamId,
  version,
  event: {
    type: "EServiceDeleted",
    event_version: 2,
    data: {
      eserviceId: streamId,
      eservice: toEServiceV2(eservice),
    },
  },
  correlationId,
});

export const toCreateEventEServiceInterfaceDeleted = (
  streamId: string,
  version: number,
  {
    descriptorId,
    documentId,
    eservice,
  }: {
    descriptorId: DescriptorId;
    documentId: EServiceDocumentId;
    eservice: EService;
  },
  correlationId: string
): CreateEvent<EServiceEvent> => ({
  streamId,
  version,
  event: {
    type: "EServiceDescriptorInterfaceDeleted",
    event_version: 2,
    data: {
      descriptorId,
      documentId,
      eservice: toEServiceV2(eservice),
    },
  },
  correlationId,
});
export const toCreateEventEServiceDocumentDeleted = (
  streamId: string,
  version: number,
  {
    descriptorId,
    documentId,
    eservice,
  }: {
    descriptorId: DescriptorId;
    documentId: EServiceDocumentId;
    eservice: EService;
  },
  correlationId: string
): CreateEvent<EServiceEvent> => ({
  streamId,
  version,
  event: {
    type: "EServiceDescriptorDocumentDeleted",
    event_version: 2,
    data: {
      descriptorId,
      documentId,
      eservice: toEServiceV2(eservice),
    },
  },
  correlationId,
});

export const toCreateEventEServiceDescriptorDeleted = (
  streamId: string,
  version: number,
  eservice: EService,
  descriptorId: DescriptorId,
  correlationId: string
): CreateEvent<EServiceEvent> => ({
  streamId,
  version,
  event: {
    type: "EServiceDescriptorDeleted",
    event_version: 2,
    data: {
      eservice: toEServiceV2(eservice),
      descriptorId,
    },
  },
  correlationId,
});

export const toCreateEventEServiceRiskAnalysisAdded = (
  streamId: string,
  version: number,
  riskAnalysisId: RiskAnalysisId,
  eservice: EService
): CreateEvent<EServiceEvent> => ({
  streamId,
  version,
  event: {
    type: "EServiceRiskAnalysisAdded",
    event_version: 2,
    data: {
      riskAnalysisId,
      eservice: toEServiceV2(eservice),
    },
  },
});
