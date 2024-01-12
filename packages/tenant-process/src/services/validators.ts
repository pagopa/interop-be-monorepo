import { AuthData, userRoles } from "pagopa-interop-commons";
import {
  Tenant,
  TenantAttribute,
  TenantVerifier,
  WithMetadata,
  operationForbidden,
  tenantAttributeType,
} from "pagopa-interop-models";
import {
  organizationNotFoundInVerifiers,
  verifiedAttributeNotFoundInTenant,
  tenantNotFound,
  expirationDateNotFoundInVerifier,
} from "../model/domain/errors.js";

export function assertTenantExists(
  tenantId: string,
  tenant: WithMetadata<Tenant> | undefined
): asserts tenant is NonNullable<WithMetadata<Tenant>> {
  if (tenant === undefined) {
    throw tenantNotFound(tenantId);
  }
}

export function assertVerifiedAttributeExistsInTenant(
  attributeId: string,
  attribute: TenantAttribute | undefined,
  tenant: WithMetadata<Tenant>
): asserts attribute is NonNullable<
  Extract<TenantAttribute, { type: "verified" }>
> {
  if (!attribute || attribute.type !== tenantAttributeType.VERIFIED) {
    throw verifiedAttributeNotFoundInTenant(tenant.data.id, attributeId);
  }
}

export function assertOrganizationVerifierExist(
  verifierId: string,
  tenantId: string,
  attributeId: string,
  tenantVerifier: TenantVerifier | undefined
): asserts tenantVerifier is NonNullable<TenantVerifier> {
  if (tenantVerifier === undefined) {
    organizationNotFoundInVerifiers(verifierId, tenantId, attributeId);
  }
}

export function assertExpirationDateExist(
  tenantId: string,
  attributeId: string,
  verifierId: string,
  tenantVerifier: TenantVerifier | undefined
): asserts tenantVerifier is NonNullable<TenantVerifier> {
  if (tenantVerifier?.expirationDate === undefined) {
    expirationDateNotFoundInVerifier(tenantId, attributeId, verifierId);
  }
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

  await assertRequesterAllowed(resourceId, organizationId);

  if (!roles.includes(userRoles.INTERNAL_ROLE)) {
    throw operationForbidden;
  }
}
