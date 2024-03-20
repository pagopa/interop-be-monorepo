import { P, match } from "ts-pattern";
import {
  AgreementApprovalPolicyV2,
  EServiceAttributeV2,
  EServiceDescriptorStateV2,
  EServiceDescriptorV2,
  EServiceDocumentV2,
  EServiceModeV2,
  EServiceRiskAnalysisV2,
  EServiceTechnologyV2,
  EServiceV2,
  RiskAnalysis,
} from "../index.js";
import {
  AgreementApprovalPolicy,
  Descriptor,
  DescriptorState,
  Document,
  EService,
  EServiceAttribute,
  EServiceMode,
  Technology,
} from "./eservice.js";

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
): EServiceRiskAnalysisV2 => ({
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
