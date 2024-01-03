import { AuthData, userRoles } from "pagopa-interop-commons";
import { match } from "ts-pattern";
import {
  Attribute,
  ExternalId,
  Tenant,
  TenantAttribute,
  TenantKind,
  TenantVerifier,
  WithMetadata,
  operationForbidden,
  tenantAttributeType,
  tenantKind,
} from "pagopa-interop-models";
import {
  organizationNotFoundInVerifiers,
  verifiedAttributeNotFoundInTenant,
  attributeNotFound,
  tenantNotFound,
  expirationDateNotFoundInVerifier,
} from "../model/domain/errors.js";
import { ReadModelService } from "./readModelService.js";

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

export function assertAttributeExists(
  attributeId: string,
  attributes: TenantAttribute[]
): asserts attributes is NonNullable<TenantAttribute[]> {
  if (!attributes.some((attr) => attr.id === attributeId)) {
    throw attributeNotFound(attributeId);
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

  await assertRequesterAllowed(resourceId, organizationId);

  if (!roles.includes(userRoles.INTERNAL_ROLE)) {
    throw operationForbidden;
  }
}

export async function getTenantKindLoadingCertifiedAttributes(
  readModelService: ReadModelService,
  attributes: TenantAttribute[],
  externalId: ExternalId
): Promise<TenantKind> {
  function getCertifiedAttributesIds(attributes: TenantAttribute[]): string[] {
    return attributes.flatMap((attr) =>
      attr.type === "certified" ? attr.id : []
    );
  }

  const convertAttributes = (
    attributes: Array<WithMetadata<Attribute>>
  ): ExternalId[] =>
    attributes.flatMap((attr) => {
      const origin = attr.data.origin;
      const code = attr.data.code;

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
