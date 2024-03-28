import { P, match } from "ts-pattern";
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
  EServiceMode,
  EServiceModeV1,
  RiskAnalysis,
  EServiceRiskAnalysisV1,
} from "../index.js";

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

export const toEServiceModeV1 = (input: EServiceMode): EServiceModeV1 =>
  match(input)
    .with("Deliver", () => EServiceModeV1.DELIVER)
    .with("Receive", () => EServiceModeV1.RECEIVE)
    .exhaustive();

export const toRiskAnalysisV1 = (
  input: RiskAnalysis
): EServiceRiskAnalysisV1 => ({
  ...input,
  createdAt: BigInt(input.createdAt.getTime()),
});

export const toEServiceV1 = (eservice: EService): EServiceV1 => ({
  ...eservice,
  technology: toEServiceTechnologyV1(eservice.technology),
  attributes:
    eservice.attributes != null
      ? {
          certified: eservice.attributes.certified.map(toEServiceAttributeV1),
          declared: eservice.attributes.declared.map(toEServiceAttributeV1),
          verified: eservice.attributes.verified.map(toEServiceAttributeV1),
        }
      : undefined,
  descriptors: eservice.descriptors.map(toDescriptorV1),
  createdAt: BigInt(eservice.createdAt.getTime()),
  mode: toEServiceModeV1(eservice.mode),
  riskAnalysis: eservice.riskAnalysis.map(toRiskAnalysisV1),
});
