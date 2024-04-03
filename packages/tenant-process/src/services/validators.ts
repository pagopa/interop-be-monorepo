import { AuthData, userRoles } from "pagopa-interop-commons";
import {
  Attribute,
  AttributeId,
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
  attributeNotFound,
  expirationDateCannotBeInThePast,
  organizationNotFoundInVerifiers,
  tenantNotFound,
  verifiedAttributeNotFoundInTenant,
  selfcareIdConflict,
  expirationDateNotFoundInVerifier,
} from "../model/domain/errors.js";
import { ReadModelService } from "./readModelService.js";

export function assertTenantExists(
  tenantId: TenantId,
  tenant: WithMetadata<Tenant> | undefined
): asserts tenant is NonNullable<WithMetadata<Tenant>> {
  if (tenant === undefined) {
    throw tenantNotFound(tenantId);
  }
}

export function assertVerifiedAttributeExistsInTenant(
  attributeId: AttributeId,
  attribute: TenantAttribute | undefined,
  tenant: WithMetadata<Tenant>
): asserts attribute is NonNullable<VerifiedTenantAttribute> {
  if (!attribute || attribute.type !== tenantAttributeType.VERIFIED) {
    throw verifiedAttributeNotFoundInTenant(tenant.data.id, attributeId);
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

async function assertRequesterAllowed(
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

export function assertAttributeExists(
  attributeId: AttributeId,
  attributes: TenantAttribute[]
): asserts attributes is NonNullable<TenantAttribute[]> {
  if (!attributes.some((attr) => attr.id === attributeId)) {
    throw attributeNotFound(attributeId);
  }
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
