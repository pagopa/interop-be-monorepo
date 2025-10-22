import {
  Agreement,
  AttributeId,
  Delegation,
  DelegationId,
  DescriptorId,
  EServiceId,
  InternalError,
  PurposeId,
  TenantId,
  TenantKind,
} from "pagopa-interop-models";

type DocumentsGeneratorErrorCode =
  | "descriptorNotFound"
  | "tenantNotFound"
  | "tenantKindNotFound"
  | "purposeDelegationNotFound"
  | "eServiceNotFound"
  | "descriptorNotFound"
  | "attributeNotFound"
  | "riskAnalysisConfigVersionNotFound"
  | "missingRiskAnalysis"
  | "agreementStampNotFound"
  | "delegationStampNotFound";

export class DocumentsGeneratorError extends InternalError<DocumentsGeneratorErrorCode> {
  constructor({
    code,
    detail,
  }: {
    code: DocumentsGeneratorErrorCode;
    detail: string;
  }) {
    super({ code, detail });
  }
}

export function tenantNotFound(tenantId: string): DocumentsGeneratorError {
  return new InternalError({
    detail: `Tenant ${tenantId} not found`,
    code: "tenantNotFound",
  });
}

export function purposeDelegationNotFound(
  purposeId: PurposeId,
  delegationId: DelegationId
): DocumentsGeneratorError {
  return new InternalError({
    detail: `Delegation ${delegationId} for purpose id ${purposeId} not found`,
    code: "purposeDelegationNotFound",
  });
}

export function eServiceNotFound(
  eserviceId: EServiceId
): DocumentsGeneratorError {
  return new InternalError({
    detail: `EService ${eserviceId} not found`,
    code: "eServiceNotFound",
  });
}

export function descriptorNotFound(
  eserviceId: EServiceId,
  descriptorId: DescriptorId
): DocumentsGeneratorError {
  return new InternalError({
    detail: `Descriptor ${descriptorId} not found in EService ${eserviceId}`,
    code: "descriptorNotFound",
  });
}

export function tenantKindNotFound(
  tenantId: TenantId
): DocumentsGeneratorError {
  return new InternalError({
    detail: `Tenant kind for tenant ${tenantId} not found`,
    code: "tenantKindNotFound",
  });
}

export function riskAnalysisConfigVersionNotFound(
  version: string,
  tenantKind: TenantKind
): DocumentsGeneratorError {
  return new InternalError({
    detail: `Risk Analysis Configuration version ${version} for tenant kind ${tenantKind} not found`,
    code: "riskAnalysisConfigVersionNotFound",
  });
}

export function missingRiskAnalysis(
  purposeId: PurposeId
): DocumentsGeneratorError {
  return new InternalError({
    detail: `Purpose ${purposeId} must contain a valid risk analysis`,
    code: "missingRiskAnalysis",
  });
}

export function agreementStampNotFound(
  stamp: keyof Agreement["stamps"]
): DocumentsGeneratorError {
  return new InternalError({
    detail: `Agreement ${stamp} stamp not found`,
    code: "agreementStampNotFound",
  });
}

export function delegationStampNotFound(
  stamp: keyof Delegation["stamps"]
): DocumentsGeneratorError {
  return new InternalError({
    detail: `Delegation ${stamp} stamp not found`,
    code: "delegationStampNotFound",
  });
}

export function attributeNotFound(
  attributeId: AttributeId
): DocumentsGeneratorError {
  return new InternalError({
    detail: `Attribute ${attributeId} not found`,
    code: "attributeNotFound",
  });
}
