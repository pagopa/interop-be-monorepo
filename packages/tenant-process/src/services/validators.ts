import { AuthData, userRoles } from "pagopa-interop-commons";
import {
  AgreementState,
  Attribute,
  AttributeId,
  EService,
  ExternalId,
  Tenant,
  TenantAttribute,
  TenantId,
  TenantKind,
  TenantVerifier,
  VerifiedTenantAttribute,
  WithMetadata,
  operationForbidden,
  tenantAttributeType,
  tenantKind,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import {
  expirationDateCannotBeInThePast,
  organizationNotFoundInVerifiers,
  verifiedAttributeNotFoundInTenant,
  selfcareIdConflict,
  expirationDateNotFoundInVerifier,
  tenantIsNotACertifier,
  verifiedAttributeSelfVerificationNotAllowed,
} from "../model/domain/errors.js";
import { ReadModelService } from "./readModelService.js";

export function assertVerifiedAttributeExistsInTenant(
  attributeId: AttributeId,
  attribute: TenantAttribute | undefined,
  tenant: WithMetadata<Tenant>
): asserts attribute is NonNullable<VerifiedTenantAttribute> {
  if (!attribute || attribute.type !== tenantAttributeType.VERIFIED) {
    throw verifiedAttributeNotFoundInTenant(tenant.data.id, attributeId);
  }
}

export async function assertVerifiedAttributeOperationAllowed({
  producerId,
  consumerId,
  attributeId,
  agreementStates,
  readModelService,
  error,
}: {
  producerId: TenantId;
  consumerId: TenantId;
  attributeId: AttributeId;
  agreementStates: AgreementState[];
  readModelService: ReadModelService;
  error: Error;
}): Promise<void> {
  if (producerId === consumerId) {
    throw verifiedAttributeSelfVerificationNotAllowed();
  }
  // Get agreements
  const agreements = await readModelService.getAgreements({
    consumerId,
    producerId,
    states: agreementStates,
  });

  // Extract descriptor IDs
  const descriptorIds = agreements.map((agreement) => agreement.descriptorId);

  // Get eServices concurrently
  const eServices = (
    await Promise.all(
      agreements.map((agreement) =>
        readModelService.getEServiceById(agreement.eserviceId)
      )
    )
  ).filter((eService): eService is EService => eService !== undefined);

  // Find verified attribute IDs
  const attributeIds = new Set(
    eServices
      .flatMap((eService) =>
        eService.descriptors.filter((descriptor) =>
          descriptorIds.includes(descriptor.id)
        )
      )
      .flatMap((descriptor) =>
        descriptor.attributes.verified.flatMap((attribute) =>
          attribute.map((a) => a.id)
        )
      )
  );
  // Check if attribute is allowed
  if (!attributeIds.has(attributeId)) {
    throw error;
  }
}

export function assertOrganizationVerifierExist(
  verifierId: string,
  tenantId: TenantId,
  attributeId: AttributeId,
  tenantVerifier: TenantVerifier | undefined
): asserts tenantVerifier is NonNullable<TenantVerifier> {
  if (tenantVerifier === undefined) {
    throw organizationNotFoundInVerifiers(verifierId, tenantId, attributeId);
  }
}

export function assertExpirationDateExist(
  tenantId: TenantId,
  attributeId: string,
  verifierId: string,
  expirationDate: Date | undefined
): asserts expirationDate is Date {
  if (expirationDate === undefined) {
    throw expirationDateNotFoundInVerifier(verifierId, attributeId, tenantId);
  }
}

const PUBLIC_ADMINISTRATIONS_IDENTIFIER = "IPA";
const CONTRACT_AUTHORITY_PUBLIC_SERVICES_MANAGERS = "SAG";
const PUBLIC_SERVICES_MANAGERS = "L37";

export function getTenantKind(
  attributes: ExternalId[],
  externalId: ExternalId
): TenantKind {
  return match(externalId.origin)
    .with(
      PUBLIC_ADMINISTRATIONS_IDENTIFIER,
      // condition to be satisfied
      (origin) =>
        attributes.some(
          (attr) =>
            attr.origin === origin &&
            (attr.value === PUBLIC_SERVICES_MANAGERS ||
              attr.value === CONTRACT_AUTHORITY_PUBLIC_SERVICES_MANAGERS)
        ),
      () => tenantKind.GSP
    )
    .with(PUBLIC_ADMINISTRATIONS_IDENTIFIER, () => tenantKind.PA)
    .otherwise(() => tenantKind.PRIVATE);
}

export async function assertRequesterAllowed(
  resourceId: string,
  requesterId: string
): Promise<void> {
  if (resourceId !== requesterId) {
    throw operationForbidden;
  }
}

export async function assertResourceAllowed(
  resourceId: string,
  authData: AuthData
): Promise<void> {
  const roles = authData.userRoles;
  const organizationId = authData.organizationId;

  if (!roles.includes(userRoles.INTERNAL_ROLE)) {
    return await assertRequesterAllowed(resourceId, organizationId);
  }
}

export async function getTenantKindLoadingCertifiedAttributes(
  readModelService: ReadModelService,
  attributes: TenantAttribute[],
  externalId: ExternalId
): Promise<TenantKind> {
  function getCertifiedAttributesIds(
    attributes: TenantAttribute[]
  ): AttributeId[] {
    return attributes.flatMap((attr) =>
      attr.type === tenantAttributeType.CERTIFIED ? attr.id : []
    );
  }

  const convertAttributes = (attributes: Attribute[]): ExternalId[] =>
    attributes.flatMap((attr) => {
      const origin = attr.origin;
      const code = attr.code;

      if (origin !== undefined && code !== undefined) {
        return { origin, value: code } as ExternalId;
      } else {
        return [];
      }
    });

  const attributesIds = getCertifiedAttributesIds(attributes);
  const attrs = await readModelService.getAttributesById(attributesIds);
  const extIds = convertAttributes(attrs);
  return getTenantKind(extIds, externalId);
}

export function assertValidExpirationDate(
  expirationDate: Date | undefined
): void {
  if (expirationDate && expirationDate < new Date()) {
    throw expirationDateCannotBeInThePast(expirationDate);
  }
}

export function assertOrganizationIsInAttributeVerifiers(
  verifierId: string,
  tenantId: TenantId,
  attribute: VerifiedTenantAttribute
): void {
  if (!attribute.verifiedBy.some((v) => v.id === verifierId)) {
    throw organizationNotFoundInVerifiers(verifierId, tenantId, attribute.id);
  }
}

export function evaluateNewSelfcareId({
  tenant,
  newSelfcareId,
}: {
  tenant: Tenant;
  newSelfcareId: string;
}): void {
  if (tenant.selfcareId && tenant.selfcareId !== newSelfcareId) {
    throw selfcareIdConflict({
      tenantId: tenant.id,
      existingSelfcareId: tenant.selfcareId,
      newSelfcareId,
    });
  }
}

export function getTenantCertifierId(tenant: Tenant): string {
  const certifierFeature = tenant.features.find(
    (f) => f.type === "PersistentCertifier"
  )?.certifierId;

  if (!certifierFeature) {
    throw tenantIsNotACertifier(tenant.id);
  }
  return certifierFeature;
}
