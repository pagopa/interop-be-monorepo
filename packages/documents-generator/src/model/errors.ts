import {
  DelegationId,
  DescriptorId,
  EServiceId,
  InternalError,
  PurposeId,
  TenantId,
} from "pagopa-interop-models";

type DocumentsGeneratorErrorCode =
  | "descriptorNotFound"
  | "tenantNotFound"
  | "tenantKindNotFound"
  | "purposeDelegationNotFound"
  | "eServiceNotFound"
  | "descriptorNotFound";

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
