/* eslint-disable @typescript-eslint/no-unused-vars */
// TO BE REMOVED IN THE FUTURE
import { AuthData, userRoles } from "pagopa-interop-commons";
import { match } from "ts-pattern";
import {
  AgreementState,
  Attribute,
  AttributeNotFound,
  ErrorTypes,
  ExternalId,
  Tenant,
  TenantAttribute,
  TenantKind,
  TenantProcessError,
  WithMetadata,
  eServiceNotFound,
  operationForbidden,
  tenantIdNotFound,
  tenantKind,
} from "pagopa-interop-models";
import { readModelService } from "./readModelService.js";

export function assertTenantExist(
  tenantId: string,
  tenant: WithMetadata<Tenant> | undefined
): asserts tenant is NonNullable<WithMetadata<Tenant>> {
  if (tenant === undefined) {
    throw tenantIdNotFound(tenantId);
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

export async function assertVerifiedAttributeOperationAllowed(
  producerId: string,
  consumerId: string,
  attributeId: string,
  states: AgreementState[],
  error: TenantProcessError
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

async function assertResourceAllowed(
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
  attributes: TenantAttribute[],
  externalId: ExternalId
): Promise<TenantKind> {
  function getCertifiedAttributesIds(attributes: TenantAttribute[]): string[] {
    return attributes.flatMap((attr) =>
      attr.type === "certified" ? attr.id : []
    );
  }

  // maybe we can abstract this and place it in commons? or delete?
  function notUndefinedValue(value: string | undefined): string {
    return value !== undefined ? value : "";
  }

  // metadata nedded?
  function convertAttributes(
    attributes: Array<WithMetadata<Attribute>>
  ): ExternalId[] {
    return attributes.map((attr) => ({
      // if origin or code is a void string, he created a valid new ExternalId?
      // in that case, we throw an Error intaed of void string?
      origin: notUndefinedValue(attr.data.origin),
      value: notUndefinedValue(attr.data.code),
    }));
  }

  const attributesIds = getCertifiedAttributesIds(attributes);
  const attrs = await readModelService.getAttributesById(attributesIds);
  const extIds = convertAttributes(attrs);
  return getTenantKind(extIds, externalId);
}
