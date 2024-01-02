import { AuthData, userRoles } from "pagopa-interop-commons";
import { match } from "ts-pattern";
import {
  AgreementState,
  ApiError,
  Attribute,
  ExternalId,
  Tenant,
  TenantAttribute,
  TenantKind,
  WithMetadata,
  genericError,
  operationForbidden,
  tenantAttributeType,
  tenantKind,
} from "pagopa-interop-models";
import {
  ErrorCodes,
  attributeNotFound,
  eServiceNotFound,
  expirationDateCannotBeInThePast,
  organizationNotFoundInVerifiers,
  tenantNotFound,
  verifiedAttributeNotFoundInTenant,
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
  if (!expirationDate) {
    return;
  }

  const isValidDate = !isNaN(expirationDate.getTime());

  if (!isValidDate) {
    throw genericError(`Invalid date format for expirationDate`);
  }

  if (expirationDate < new Date()) {
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

export function assertOrganizationIsInVerifiers(
  verifierId: string,
  tenantId: string,
  attribute: Extract<TenantAttribute, { type: "verified" }>
): void {
  if (!attribute.verifiedBy.some((v) => v.id === verifierId)) {
    throw organizationNotFoundInVerifiers(verifierId, tenantId, attribute.id);
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

// eslint-disable-next-line max-params
export async function assertVerifiedAttributeOperationAllowed(
  readModelService: ReadModelService,
  producerId: string,
  consumerId: string,
  attributeId: string,
  states: AgreementState[],
  error: ApiError<ErrorCodes>
): Promise<void> {
  const agreements = await readModelService.getAgreements(
    producerId,
    consumerId,
    states
  );
  const descriptorIds = agreements.map((agreement) => agreement.descriptorId);
  const eServices = await Promise.all(
    agreements.map(
      (agreement) =>
        readModelService.getEServiceById(agreement.eserviceId) ??
        Promise.reject(eServiceNotFound(agreement.eserviceId))
    )
  );

  const attributeIds = new Set<string>(
    eServices.flatMap((eService) =>
      eService
        ? eService.data.descriptors
            .filter((descriptor) => descriptorIds.includes(descriptor.id))
            .flatMap((descriptor) => descriptor.attributes.verified)
            .flatMap((attributes) =>
              attributes.map((attribute) => attribute.id)
            )
        : []
    )
  );

  if (!attributeIds.has(attributeId)) {
    throw error;
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
