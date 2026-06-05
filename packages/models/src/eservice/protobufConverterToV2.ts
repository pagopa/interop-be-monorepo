import { P, match } from "ts-pattern";
import {
  AgreementApprovalPolicyV2,
  AttributeCertifiedDiscreteComparatorV2,
  DescriptorRejectionReasonV2,
  EServiceAttributeV2,
  EServiceDescriptorStateV2,
  EServiceDescriptorV2,
  EServiceDocumentV2,
  EServiceModeV2,
  EServiceRiskAnalysisV2,
  EServiceTechnologyV2,
  EServiceV2,
} from "../gen/v2/eservice/eservice.js";
import { RiskAnalysis } from "../risk-analysis/riskAnalysis.js";
import { dateToBigInt } from "../utils.js";
import {
  AgreementApprovalPolicy,
  AttributeCertifiedDiscreteComparator,
  Descriptor,
  DescriptorRejectionReason,
  DescriptorState,
  Document,
  EService,
  EServiceAttribute,
  EServiceAttributeCertified,
  EServiceMode,
  EServiceAttributeCertifiedDiscrete,
  Technology,
  agreementApprovalPolicy,
  attributeCertifiedDiscreteComparator,
  descriptorState,
  eserviceMode,
  technology,
  type EServiceAttributeCertifiedDiscreteConfig,
} from "./eservice.js";

const toAgreementApprovalPolicyV2 = (
  input: AgreementApprovalPolicy | undefined
): AgreementApprovalPolicyV2 =>
  match(input)
    .with(P.nullish, () => AgreementApprovalPolicyV2.AUTOMATIC)
    .with(
      agreementApprovalPolicy.manual,
      () => AgreementApprovalPolicyV2.MANUAL
    )
    .with(
      agreementApprovalPolicy.automatic,
      () => AgreementApprovalPolicyV2.AUTOMATIC
    )
    .exhaustive();

export const toEServiceDescriptorStateV2 = (
  input: DescriptorState
): EServiceDescriptorStateV2 =>
  match(input)
    .with(descriptorState.draft, () => EServiceDescriptorStateV2.DRAFT)
    .with(descriptorState.suspended, () => EServiceDescriptorStateV2.SUSPENDED)
    .with(descriptorState.archived, () => EServiceDescriptorStateV2.ARCHIVED)
    .with(descriptorState.published, () => EServiceDescriptorStateV2.PUBLISHED)
    .with(
      descriptorState.deprecated,
      () => EServiceDescriptorStateV2.DEPRECATED
    )
    .with(
      descriptorState.waitingForApproval,
      () => EServiceDescriptorStateV2.WAITING_FOR_APPROVAL
    )
    .exhaustive();

export const toEServiceTechnologyV2 = (
  input: Technology
): EServiceTechnologyV2 =>
  match(input)
    .with(technology.rest, () => EServiceTechnologyV2.REST)
    .with(technology.soap, () => EServiceTechnologyV2.SOAP)
    .exhaustive();

export const toEServiceModeV2 = (input: EServiceMode): EServiceModeV2 =>
  match(input)
    .with(eserviceMode.deliver, () => EServiceModeV2.DELIVER)
    .with(eserviceMode.receive, () => EServiceModeV2.RECEIVE)
    .exhaustive();

export const toEServiceAttributeV2 = (
  input: EServiceAttribute[]
): EServiceAttributeV2 => ({
  values: input.map((i) => ({
    id: i.id,
    explicitAttributeVerification: i.explicitAttributeVerification,
  })),
});

export const toAttributeCertifiedDiscreteComparatorV2 = (
  input: AttributeCertifiedDiscreteComparator
): AttributeCertifiedDiscreteComparatorV2 =>
  match(input)
    .with(
      attributeCertifiedDiscreteComparator.GT,
      () => AttributeCertifiedDiscreteComparatorV2.GT
    )
    .with(
      attributeCertifiedDiscreteComparator.LT,
      () => AttributeCertifiedDiscreteComparatorV2.LT
    )
    .with(
      attributeCertifiedDiscreteComparator.EQ,
      () => AttributeCertifiedDiscreteComparatorV2.EQ
    )
    .with(
      attributeCertifiedDiscreteComparator.GTE,
      () => AttributeCertifiedDiscreteComparatorV2.GTE
    )
    .with(
      attributeCertifiedDiscreteComparator.LTE,
      () => AttributeCertifiedDiscreteComparatorV2.LTE
    )
    .with(
      attributeCertifiedDiscreteComparator.NE,
      () => AttributeCertifiedDiscreteComparatorV2.NE
    )
    .exhaustive();

export const toCertifiedDiscreteConfigV2 = (
  items: EServiceAttributeCertifiedDiscreteConfig
) => ({
  threshold: items.threshold,
  comparator: toAttributeCertifiedDiscreteComparatorV2(items.comparator),
});

export const toEServiceAttributeCertifiedV2 = (
  input: (EServiceAttributeCertified | EServiceAttributeCertifiedDiscrete)[]
): EServiceAttributeV2 => ({
  values: input.map((attribute) => ({
    id: attribute.id,
    explicitAttributeVerification: attribute.explicitAttributeVerification,
    dailyCallsPerConsumer: attribute.dailyCallsPerConsumer,
    ...("discreteConfig" in attribute
      ? {
          discreteConfig: toCertifiedDiscreteConfigV2(attribute.discreteConfig),
        }
      : undefined),
  })),
});

export const toDescriptorRejectedReasonV2 = (
  input: DescriptorRejectionReason
): DescriptorRejectionReasonV2 => ({
  ...input,
  rejectedAt: dateToBigInt(input.rejectedAt),
});

export const toDocumentV2 = (input: Document): EServiceDocumentV2 => ({
  ...input,
  uploadDate: input.uploadDate.toISOString(),
});

export const toDescriptorV2 = (input: Descriptor): EServiceDescriptorV2 => ({
  ...input,
  version: BigInt(input.version),
  attributes: {
    certified: input.attributes.certified.map(toEServiceAttributeCertifiedV2),
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
  createdAt: dateToBigInt(input.createdAt),
  publishedAt: dateToBigInt(input.publishedAt),
  suspendedAt: dateToBigInt(input.suspendedAt),
  deprecatedAt: dateToBigInt(input.deprecatedAt),
  archivedAt: dateToBigInt(input.archivedAt),
  rejectionReasons:
    input.rejectionReasons?.map(toDescriptorRejectedReasonV2) ?? [],
});

export const toRiskAnalysisV2 = (
  input: RiskAnalysis
): EServiceRiskAnalysisV2 => ({
  ...input,
  createdAt: dateToBigInt(input.createdAt),
});

export const toEServiceV2 = (eservice: EService): EServiceV2 => ({
  ...eservice,
  technology: toEServiceTechnologyV2(eservice.technology),
  descriptors: eservice.descriptors.map(toDescriptorV2),
  createdAt: dateToBigInt(eservice.createdAt),
  mode: toEServiceModeV2(eservice.mode),
  riskAnalysis: eservice.riskAnalysis.map(toRiskAnalysisV2),
});
