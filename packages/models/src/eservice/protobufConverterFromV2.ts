import { EServiceTemplateId, unsafeBrandId } from "../brandedIds.js";
import { genericInternalError } from "../errors.js";
import {
  AgreementApprovalPolicyV2,
  AttributeCertifiedDiscreteComparatorV2,
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
  type EServiceAttributeCertifiedDiscreteConfigV2,
  ArchivingScopeV2,
  GracePeriodDaysV2,
} from "../gen/v2/eservice/eservice.js";
import {
  RiskAnalysis,
  RiskAnalysisForm,
} from "../risk-analysis/riskAnalysis.js";
import { fromTenantKindV2 } from "../tenant/protobufConverterFromV2.js";
import { bigIntToDate } from "../utils.js";
import {
  AgreementApprovalPolicy,
  agreementApprovalPolicy,
  AttributeCertifiedDiscreteComparator,
  attributeCertifiedDiscreteComparator,
  DescriptorState,
  descriptorState,
  Technology,
  technology,
  EServiceMode,
  eserviceMode,
  EServiceAttribute,
  EServiceAttributeCertified,
  EServiceAttributeCertifiedDiscrete,
  Descriptor,
  EService,
  Document,
  DescriptorRejectionReason,
  EServiceTemplateVersionRef,
  type EServiceAttributeCertifiedDiscreteConfig,
  ArchivingScope,
  archivingScope,
  GracePeriodDays,
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
    case EServiceDescriptorStateV2.ARCHIVING:
      return descriptorState.archiving;
    case EServiceDescriptorStateV2.ARCHIVING_SUSPENDED:
      return descriptorState.archivingSuspended;
  }
};

export const fromEServiceDescriptorArchivingScopeV2 = (
  input: ArchivingScopeV2
): ArchivingScope => {
  switch (input) {
    case ArchivingScopeV2.ESERVICE:
      return archivingScope.eservice;
    case ArchivingScopeV2.DESCRIPTOR:
      return archivingScope.descriptor;
  }
};

export const fromGracePeriodDaysV2 = (
  input: GracePeriodDaysV2
): GracePeriodDays => {
  switch (input) {
    case GracePeriodDaysV2.GRACE_PERIOD_30_DAYS:
      return 30;
    case GracePeriodDaysV2.GRACE_PERIOD_60_DAYS:
      return 60;
    case GracePeriodDaysV2.GRACE_PERIOD_90_DAYS:
      return 90;
    case GracePeriodDaysV2.GRACE_PERIOD_120_DAYS:
      return 120;
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
  input.values.map((a) => ({ ...a, id: unsafeBrandId(a.id) }));

const fromAttributeCertifiedDiscreteComparatorV2 = (
  input: AttributeCertifiedDiscreteComparatorV2
): AttributeCertifiedDiscreteComparator => {
  switch (input) {
    case AttributeCertifiedDiscreteComparatorV2.GT:
      return attributeCertifiedDiscreteComparator.GT;
    case AttributeCertifiedDiscreteComparatorV2.LT:
      return attributeCertifiedDiscreteComparator.LT;
    case AttributeCertifiedDiscreteComparatorV2.EQ:
      return attributeCertifiedDiscreteComparator.EQ;
    case AttributeCertifiedDiscreteComparatorV2.GTE:
      return attributeCertifiedDiscreteComparator.GTE;
    case AttributeCertifiedDiscreteComparatorV2.LTE:
      return attributeCertifiedDiscreteComparator.LTE;
    case AttributeCertifiedDiscreteComparatorV2.NE:
      return attributeCertifiedDiscreteComparator.NE;
    case AttributeCertifiedDiscreteComparatorV2.UNSPECIFIED:
      throw genericInternalError(
        "Unspecified AttributeCertifiedDiscreteComparator in protobuf event"
      );
  }
};

export const fromCertifiedDiscreteConfigV2 = (
  input: EServiceAttributeCertifiedDiscreteConfigV2
): EServiceAttributeCertifiedDiscreteConfig => ({
  threshold: input.threshold,
  comparator: fromAttributeCertifiedDiscreteComparatorV2(input.comparator),
});

export const fromEServiceAttributeCertifiedV2 = (
  input: EServiceAttributeV2
): (EServiceAttributeCertifiedDiscrete | EServiceAttributeCertified)[] =>
  input.values.map((attribute) => {
    const common: EServiceAttributeCertified = {
      id: unsafeBrandId(attribute.id),
      explicitAttributeVerification: attribute.explicitAttributeVerification,
      dailyCallsPerConsumer: attribute.dailyCallsPerConsumer,
    };
    return attribute.discreteConfig != null
      ? {
          ...common,
          discreteConfig: fromCertifiedDiscreteConfigV2(
            attribute.discreteConfig
          ),
        }
      : common;
  });

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
          certified: input.attributes.certified.map(
            fromEServiceAttributeCertifiedV2
          ),
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
  asyncExchangeCallbackInterface:
    input.asyncExchangeCallbackInterface != null
      ? fromDocumentV2(input.asyncExchangeCallbackInterface)
      : undefined,
  asyncExchangeProperties:
    input.asyncExchangeProperties != null
      ? {
          responseTime: input.asyncExchangeProperties.responseTime,
          resourceAvailableTime:
            input.asyncExchangeProperties.resourceAvailableTime,
          confirmation: input.asyncExchangeProperties.confirmation,
          bulk: input.asyncExchangeProperties.bulk,
          maxResultSet: input.asyncExchangeProperties.maxResultSet,
        }
      : undefined,
  audience: input.audience.map((aud) => aud.replaceAll("\u0000", "")),
  archivingSchedule: input.archivingSchedule
    ? {
        archivableOn: bigIntToDate(input.archivingSchedule.archivableOn),
        startedAt: bigIntToDate(input.archivingSchedule.startedAt),
        scope: fromEServiceDescriptorArchivingScopeV2(
          input.archivingSchedule.scope
        ),
        gracePeriodDays: fromGracePeriodDaysV2(
          input.archivingSchedule.gracePeriodDays
        ),
      }
    : undefined,
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
    tenantKind:
      input.tenantKind != null ? fromTenantKindV2(input.tenantKind) : undefined,
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
