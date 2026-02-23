import { EServiceTemplateId, unsafeBrandId } from "../brandedIds.js";
import {
  AgreementApprovalPolicyV2,
  EServiceAttributeV2,
  EServiceDescriptorStateV2,
  EServiceDescriptorV2,
  EServiceDocumentV2,
  EServiceTechnologyV2,
  EServiceV2,
  EServiceModeV2,
  EServiceRiskAnalysisV2,
  EServiceRiskAnalysisFormV2,
  DescriptorRejectionReasonV2,
  EServiceTemplateVersionRefV2,
} from "../gen/v2/eservice/eservice.js";
import {
  RiskAnalysis,
  RiskAnalysisForm,
} from "../risk-analysis/riskAnalysis.js";
import { bigIntToDate } from "../utils.js";
import {
  AgreementApprovalPolicy,
  agreementApprovalPolicy,
  DescriptorState,
  descriptorState,
  Technology,
  technology,
  EServiceMode,
  eserviceMode,
  EServiceAttribute,
  Descriptor,
  EService,
  Document,
  DescriptorRejectionReason,
  EServiceTemplateVersionRef,
} from "./eservice.js";

export const fromAgreementApprovalPolicyV2 = (
  input: AgreementApprovalPolicyV2
): AgreementApprovalPolicy => {
  switch (input) {
    case AgreementApprovalPolicyV2.MANUAL:
      return agreementApprovalPolicy.manual;
    case AgreementApprovalPolicyV2.AUTOMATIC:
      return agreementApprovalPolicy.automatic;
  }
};

export const fromEServiceDescriptorStateV2 = (
  input: EServiceDescriptorStateV2
): DescriptorState => {
  switch (input) {
    case EServiceDescriptorStateV2.DRAFT:
      return descriptorState.draft;
    case EServiceDescriptorStateV2.SUSPENDED:
      return descriptorState.suspended;
    case EServiceDescriptorStateV2.ARCHIVED:
      return descriptorState.archived;
    case EServiceDescriptorStateV2.PUBLISHED:
      return descriptorState.published;
    case EServiceDescriptorStateV2.DEPRECATED:
      return descriptorState.deprecated;
    case EServiceDescriptorStateV2.WAITING_FOR_APPROVAL:
      return descriptorState.waitingForApproval;
  }
};

export const fromEServiceTechnologyV2 = (
  input: EServiceTechnologyV2
): Technology => {
  switch (input) {
    case EServiceTechnologyV2.REST:
      return technology.rest;
    case EServiceTechnologyV2.SOAP:
      return technology.soap;
  }
};

export const fromEServiceModeV2 = (input: EServiceModeV2): EServiceMode => {
  switch (input) {
    case EServiceModeV2.RECEIVE:
      return eserviceMode.receive;
    case EServiceModeV2.DELIVER:
      return eserviceMode.deliver;
  }
};

export const fromEServiceAttributeV2 = (
  input: EServiceAttributeV2
): EServiceAttribute[] =>
  input.values.map((a) => ({ id: unsafeBrandId(a.id) }));

export function fromDocumentV2(input: EServiceDocumentV2): Document {
  return {
    ...input,
    id: unsafeBrandId(input.id),
    uploadDate: new Date(input.uploadDate),
  };
}

export const fromDescriptorRejectionReasonV2 = (
  input: DescriptorRejectionReasonV2
): DescriptorRejectionReason => ({
  ...input,
  rejectedAt: bigIntToDate(input.rejectedAt),
});

export const fromEServiceTemplateVersionRefV2 = (
  input: EServiceTemplateVersionRefV2
): EServiceTemplateVersionRef => ({
  id: unsafeBrandId(input.id),
  interfaceMetadata: input.interfaceMetadata,
});

export const fromDescriptorV2 = (input: EServiceDescriptorV2): Descriptor => ({
  ...input,
  id: unsafeBrandId(input.id),
  version: input.version.toString(),
  attributes:
    input.attributes != null
      ? {
          certified: input.attributes.certified.map(fromEServiceAttributeV2),
          declared: input.attributes.declared.map(fromEServiceAttributeV2),
          verified: input.attributes.verified.map(fromEServiceAttributeV2),
        }
      : {
          certified: [],
          declared: [],
          verified: [],
        },
  docs: input.docs.map(fromDocumentV2),
  state: fromEServiceDescriptorStateV2(input.state),
  interface:
    input.interface != null ? fromDocumentV2(input.interface) : undefined,
  agreementApprovalPolicy: fromAgreementApprovalPolicyV2(
    input.agreementApprovalPolicy
  ),
  createdAt: bigIntToDate(input.createdAt),
  publishedAt: bigIntToDate(input.publishedAt),
  suspendedAt: bigIntToDate(input.suspendedAt),
  deprecatedAt: bigIntToDate(input.deprecatedAt),
  archivedAt: bigIntToDate(input.archivedAt),
  rejectionReasons:
    input.rejectionReasons.length > 0
      ? input.rejectionReasons.map(fromDescriptorRejectionReasonV2)
      : undefined,
  templateVersionRef:
    input.templateVersionRef != null
      ? fromEServiceTemplateVersionRefV2(input.templateVersionRef)
      : undefined,
  audience: input.audience.map((aud) => aud.replaceAll("\u0000", "")),
});

export const fromRiskAnalysisFormV2 = (
  input: EServiceRiskAnalysisFormV2 | undefined
): RiskAnalysisForm => {
  if (!input) {
    // riskAnalysisForm is required in EService definition but not in protobuf
    // tracked in https://pagopa.atlassian.net/browse/IMN-171
    throw new Error(
      "riskAnalysisForm field is required in EService definition but is not provided in serialized byte array events"
    );
  }

  return {
    ...input,
    id: unsafeBrandId(input.id),
    singleAnswers: input.singleAnswers.map((a) => ({
      ...a,
      id: unsafeBrandId(a.id),
    })),
    multiAnswers: input.multiAnswers.map((a) => ({
      ...a,
      id: unsafeBrandId(a.id),
    })),
  };
};

export const fromRiskAnalysisV2 = (
  input: EServiceRiskAnalysisV2
): RiskAnalysis => ({
  ...input,
  id: unsafeBrandId(input.id),
  createdAt: bigIntToDate(input.createdAt),
  riskAnalysisForm: fromRiskAnalysisFormV2(input.riskAnalysisForm),
});

export const fromEServiceV2 = (input: EServiceV2): EService => ({
  ...input,
  id: unsafeBrandId(input.id),
  producerId: unsafeBrandId(input.producerId),
  technology: fromEServiceTechnologyV2(input.technology),
  descriptors: input.descriptors.map(fromDescriptorV2),
  createdAt: bigIntToDate(input.createdAt),
  riskAnalysis: input.riskAnalysis.map(fromRiskAnalysisV2),
  mode: fromEServiceModeV2(input.mode),
  templateId:
    input.templateId != null
      ? unsafeBrandId<EServiceTemplateId>(input.templateId)
      : undefined,
});
