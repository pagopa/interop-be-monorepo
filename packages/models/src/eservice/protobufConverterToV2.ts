import { P, match } from "ts-pattern";
import {
  AgreementApprovalPolicyV2,
  AttributeCertifiedDiscreteComparatorV2,
  ArchivingScopeV2,
  DescriptorRejectionReasonV2,
  EServiceAttributeV2,
  EServiceDescriptorStateV2,
  EServiceDescriptorV2,
  EServiceDocumentV2,
  EServiceModeV2,
  EServiceRiskAnalysisV2,
  EServiceRiskAnalysisFormV2,
  EServiceTechnologyV2,
  EServiceV2,
  DelegatedDescriptorArchivingRequestV2,
  DelegatedEServiceArchivingRequestV2,
} from "../gen/v2/eservice/eservice.js";
import {
  RiskAnalysis,
  RiskAnalysisForm,
} from "../risk-analysis/riskAnalysis.js";
import { dateToBigInt } from "../utils.js";
import {
  AgreementApprovalPolicy,
  AttributeCertifiedDiscreteComparator,
  ArchivingScope,
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
  archivingScope,
  descriptorState,
  eserviceMode,
  technology,
  type EServiceAttributeCertifiedDiscreteConfig,
  DelegatedArchivingRequest,
} from "./eservice.js";
import { toTenantKindV2 } from "../tenant/protobufConverterToV2.js";

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
    .with(descriptorState.archiving, () => EServiceDescriptorStateV2.ARCHIVING)
    .with(
      descriptorState.archivingSuspended,
      () => EServiceDescriptorStateV2.ARCHIVING_SUSPENDED
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

// The domain model keeps a single, unified `DelegatedArchivingRequest[]` on
// `EService` (discriminated by `scope`/`descriptorId`), but the wire format
// still has two distinct repeated fields (one on EServiceV2, one on each
// EServiceDescriptorV2) for backward compatibility. These two converters
// route each domain entry to the proto message matching its scope.
export const toDelegatedDescriptorArchivingRequestV2 = (
  input: DelegatedArchivingRequest
): DelegatedDescriptorArchivingRequestV2 => ({
  requestedAt: dateToBigInt(input.requestedAt),
  acceptedAt: dateToBigInt(input.acceptedAt),
  rejectedAt: dateToBigInt(input.rejectedAt),
  rejectionReason: input.rejectionReason,
  requesterId: input.requesterId,
  gracePeriodDays: input.gracePeriodDays,
});

export const toDelegatedEServiceArchivingRequestV2 = (
  input: DelegatedArchivingRequest
): DelegatedEServiceArchivingRequestV2 => ({
  requestedAt: dateToBigInt(input.requestedAt),
  acceptedAt: dateToBigInt(input.acceptedAt),
  rejectedAt: dateToBigInt(input.rejectedAt),
  rejectionReason: input.rejectionReason,
  requesterId: input.requesterId,
  gracePeriodDays: input.gracePeriodDays,
  archivingReason: input.archivingReason ?? "",
});

export const toDocumentV2 = (input: Document): EServiceDocumentV2 => ({
  ...input,
  uploadDate: input.uploadDate.toISOString(),
});

export const toEServiceDescriptorArchivingScopeV2 = (
  input: ArchivingScope
): ArchivingScopeV2 =>
  match(input)
    .with(archivingScope.eservice, () => ArchivingScopeV2.ESERVICE)
    .with(archivingScope.descriptor, () => ArchivingScopeV2.DESCRIPTOR)
    .exhaustive();

export const toDescriptorV2 = (
  input: Descriptor,
  eserviceDelegatedArchivingRequests: DelegatedArchivingRequest[] = []
): EServiceDescriptorV2 => ({
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
  archivingSchedule: input.archivingSchedule
    ? {
        archivableOn: dateToBigInt(input.archivingSchedule.archivableOn),
        startedAt: dateToBigInt(input.archivingSchedule.startedAt),
        scope: toEServiceDescriptorArchivingScopeV2(
          input.archivingSchedule.scope
        ),
        gracePeriodDays: input.archivingSchedule.gracePeriodDays ?? 30,
      }
    : undefined,
  asyncExchangeCallbackInterface: input.asyncExchangeCallbackInterface
    ? toDocumentV2(input.asyncExchangeCallbackInterface)
    : undefined,
  asyncExchangeProperties: input.asyncExchangeProperties
    ? { ...input.asyncExchangeProperties }
    : undefined,
  delegatedArchivingRequest: eserviceDelegatedArchivingRequests
    .filter(
      (r) => r.scope === archivingScope.descriptor && r.descriptorId === input.id
    )
    .map(toDelegatedDescriptorArchivingRequestV2),
});

export const toRiskAnalysisV2 = (
  input: RiskAnalysis
): EServiceRiskAnalysisV2 => ({
  ...input,
  createdAt: dateToBigInt(input.createdAt),
  riskAnalysisForm: toRiskAnalysisFormV2(input.riskAnalysisForm),
});

export const toRiskAnalysisFormV2 = (
  input: RiskAnalysisForm
): EServiceRiskAnalysisFormV2 => ({
  ...input,
  tenantKind: input.tenantKind ? toTenantKindV2(input.tenantKind) : undefined,
});

export const toEServiceV2 = (eservice: EService): EServiceV2 => ({
  ...eservice,
  technology: toEServiceTechnologyV2(eservice.technology),
  descriptors: eservice.descriptors.map((descriptor) =>
    toDescriptorV2(descriptor, eservice.delegatedArchivingRequest)
  ),
  createdAt: dateToBigInt(eservice.createdAt),
  mode: toEServiceModeV2(eservice.mode),
  riskAnalysis: eservice.riskAnalysis.map(toRiskAnalysisV2),
  delegatedArchivingRequest: (eservice.delegatedArchivingRequest ?? [])
    .filter((r) => r.scope === archivingScope.eservice)
    .map(toDelegatedEServiceArchivingRequestV2),
});
