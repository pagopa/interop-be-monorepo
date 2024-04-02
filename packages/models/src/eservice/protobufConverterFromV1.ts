import { P, match } from "ts-pattern";
import { unsafeBrandId } from "../brandedIds.js";
import {
  AgreementApprovalPolicyV1,
  EServiceDescriptorStateV1,
  EServiceTechnologyV1,
  EServiceModeV1,
  EServiceAttributeV1,
  EServiceDocumentV1,
  EServiceDescriptorV1,
  EServiceRiskAnalysisFormV1,
  EServiceRiskAnalysisV1,
  EServiceV1,
} from "../gen/v1/eservice/eservice.js";
import { parseDateOrThrow } from "../protobuf/utils.js";
import {
  RiskAnalysis,
  RiskAnalysisForm,
} from "../risk-analysis/riskAnalysis.js";
import {
  AgreementApprovalPolicy,
  Descriptor,
  DescriptorState,
  Document,
  EService,
  EServiceAttribute,
  EServiceMode,
  Technology,
  agreementApprovalPolicy,
  descriptorState,
  eserviceMode,
  technology,
} from "./eservice.js";

export const fromAgreementApprovalPolicyV1 = (
  input: AgreementApprovalPolicyV1 | undefined
): AgreementApprovalPolicy | undefined => {
  if (input == null) {
    return undefined;
  }

  switch (input) {
    case AgreementApprovalPolicyV1.MANUAL:
      return agreementApprovalPolicy.manual;
    case AgreementApprovalPolicyV1.AUTOMATIC:
      return agreementApprovalPolicy.automatic;
    case AgreementApprovalPolicyV1.UNSPECIFIED$:
      throw new Error("Unspecified agreement approval policy");
  }
};

export const fromEServiceDescriptorStateV1 = (
  input: EServiceDescriptorStateV1
): DescriptorState => {
  switch (input) {
    case EServiceDescriptorStateV1.DRAFT:
      return descriptorState.draft;
    case EServiceDescriptorStateV1.SUSPENDED:
      return descriptorState.suspended;
    case EServiceDescriptorStateV1.ARCHIVED:
      return descriptorState.archived;
    case EServiceDescriptorStateV1.PUBLISHED:
      return descriptorState.published;
    case EServiceDescriptorStateV1.DEPRECATED:
      return descriptorState.deprecated;
    case EServiceDescriptorStateV1.UNSPECIFIED$:
      throw new Error("Unspecified descriptor state");
  }
};

export const fromEServiceTechnologyV1 = (
  input: EServiceTechnologyV1
): Technology => {
  switch (input) {
    case EServiceTechnologyV1.REST:
      return technology.rest;
    case EServiceTechnologyV1.SOAP:
      return technology.soap;
    case EServiceTechnologyV1.UNSPECIFIED$:
      throw new Error("Unspecified technology");
  }
};

export const fromEServiceModeV1 = (
  input: EServiceModeV1 | undefined
): EServiceMode => {
  switch (input) {
    case EServiceModeV1.RECEIVE:
      return eserviceMode.receive;
    case EServiceModeV1.DELIVER:
      return eserviceMode.deliver;
    case EServiceModeV1.UNSPECIFIED$:
    case undefined:
      return eserviceMode.deliver;
  }
};

export const fromEServiceAttributeV1 = (
  input: EServiceAttributeV1
): EServiceAttribute[] =>
  match<EServiceAttributeV1, EServiceAttribute[]>(input)
    .with(
      {
        single: P.not(P.nullish),
      },
      ({ single }) => [{ ...single, id: unsafeBrandId(single.id) }]
    )
    .otherwise(() =>
      input.group.map((a) => ({ ...a, id: unsafeBrandId(a.id) }))
    );

export const fromDocumentV1 = (input: EServiceDocumentV1): Document => ({
  ...input,
  id: unsafeBrandId(input.id),
  uploadDate: new Date(input.uploadDate),
});

export const fromDescriptorV1 = (input: EServiceDescriptorV1): Descriptor => ({
  ...input,
  id: unsafeBrandId(input.id),
  attributes:
    input.attributes != null
      ? {
          certified: input.attributes.certified.map(fromEServiceAttributeV1),
          declared: input.attributes.declared.map(fromEServiceAttributeV1),
          verified: input.attributes.verified.map(fromEServiceAttributeV1),
        }
      : {
          certified: [],
          declared: [],
          verified: [],
        },
  docs: input.docs.map(fromDocumentV1),
  state: fromEServiceDescriptorStateV1(input.state),
  interface:
    input.interface != null ? fromDocumentV1(input.interface) : undefined,
  agreementApprovalPolicy: fromAgreementApprovalPolicyV1(
    input.agreementApprovalPolicy
  ),
  // createdAt is required in EService definition but not in protobuf,
  // this bug is handled with ISSUE https://pagopa.atlassian.net/browse/IMN-171
  createdAt: parseDateOrThrow(input.createdAt),
  publishedAt: input.publishedAt
    ? new Date(Number(input.publishedAt))
    : undefined,
  suspendedAt: input.suspendedAt
    ? new Date(Number(input.suspendedAt))
    : undefined,
  deprecatedAt: input.deprecatedAt
    ? new Date(Number(input.deprecatedAt))
    : undefined,
  archivedAt: input.archivedAt ? new Date(Number(input.archivedAt)) : undefined,
});

export const fromRiskAnalysisFormV1 = (
  input: EServiceRiskAnalysisFormV1 | undefined
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

export const fromRiskAnalysisV1 = (
  input: EServiceRiskAnalysisV1
): RiskAnalysis => ({
  ...input,
  id: unsafeBrandId(input.id),
  createdAt: new Date(Number(input.createdAt)),
  riskAnalysisForm: fromRiskAnalysisFormV1(input.riskAnalysisForm),
});

export const fromEServiceV1 = (input: EServiceV1): EService => ({
  ...input,
  id: unsafeBrandId(input.id),
  producerId: unsafeBrandId(input.producerId),
  technology: fromEServiceTechnologyV1(input.technology),
  attributes:
    input.attributes != null
      ? {
          certified: input.attributes.certified.map(fromEServiceAttributeV1),
          declared: input.attributes.declared.map(fromEServiceAttributeV1),
          verified: input.attributes.verified.map(fromEServiceAttributeV1),
        }
      : undefined,
  descriptors: input.descriptors.map(fromDescriptorV1),
  // createdAt is required in EService definition but not in protobuf
  // tracked in https://pagopa.atlassian.net/browse/IMN-171
  createdAt: parseDateOrThrow(input.createdAt),
  riskAnalysis: input.riskAnalysis.map(fromRiskAnalysisV1),
  mode: fromEServiceModeV1(input.mode),
});
