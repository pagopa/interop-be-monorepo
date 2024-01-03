import { AuthData, userRoles } from "pagopa-interop-commons";
import { match } from "ts-pattern";
import {
  Attribute,
  ExternalId,
  Tenant,
  TenantAttribute,
  TenantKind,
  WithMetadata,
  operationForbidden,
  tenantAttributeType,
  tenantKind,
} from "pagopa-interop-models";
import {
  attributeNotFound,
  expirationDateCannotBeInThePast,
  organizationNotFoundInVerifiers,
  tenantNotFound,
  verifiedAttributeNotFoundInTenant,
} from "../model/domain/errors.js";
import { ReadModelService } from "./readModelService.js";

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

export function assertTenantExists(
  tenantId: string,
  tenant: WithMetadata<Tenant> | undefined
): asserts tenant is NonNullable<WithMetadata<Tenant>> {
  if (tenant === undefined) {
    throw tenantNotFound(tenantId);
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

export function assertValidExpirationDate(
  expirationDate: Date | undefined
): void {
  if (expirationDate && expirationDate < new Date()) {
    throw expirationDateCannotBeInThePast(expirationDate);
  }
}

export function assertVerifiedAttributeExistsInTenant(
  attributeId: string,
  attribute: TenantAttribute | undefined,
  tenantId: string
): asserts attribute is NonNullable<
  Extract<TenantAttribute, { type: "verified" }>
> {
  if (!attribute || attribute.type !== tenantAttributeType.VERIFIED) {
    throw verifiedAttributeNotFoundInTenant(tenantId, attributeId);
  }
}

export function assertOrganizationIsInAttributeVerifiers(
  verifierId: string,
  tenantId: string,
  attribute: Extract<TenantAttribute, { type: "verified" }>
): void {
  if (!attribute.verifiedBy.some((v) => v.id === verifierId)) {
    throw organizationNotFoundInVerifiers(verifierId, tenantId, attribute.id);
  }
}
