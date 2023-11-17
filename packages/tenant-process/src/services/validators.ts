// import { AuthData, userRoles } from "pagopa-interop-commons";
import { match } from "ts-pattern";
import {
  AgreementState,
  ErrorTypes,
  ExternalId,
  Tenant,
  TenantKind,
  WithMetadata,
  //   operationForbidden,
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
  states: AgreementState[]
): Promise<void> {
  const agreements = await readModelService.getAgreements(
    producerId,
    consumerId,
    states
  );
  const descriptorIds = agreements.map((agreement) => agreement.descriptorId);
  const eServices = await Promise.all(
    agreements.map((agreement) => {
      const eService = readModelService.getEServiceById(agreement.eserviceId);
      if (eService === undefined) {
        throw ErrorTypes.GenericError;
      } else {
        return eService;
      }
    })
  );

  const attributeIds = new Set<string>(
    eServices.flatMap((eService) => {
      if (eService === undefined) {
        throw ErrorTypes.GenericError;
      } else {
        return eService.data.descriptors
          .filter((descriptor) => descriptorIds.includes(descriptor.id))
          .flatMap((descriptor) => descriptor.attributes.verified)
          .flatMap((attributes) => attributes.map((attribute) => attribute.id));
      }
    })
  );

  if (!attributeIds.has(attributeId)) {
    throw ErrorTypes.GenericError;
  } else {
    return Promise.resolve();
  }
}

// async function assertRequesterAllowed(
//   resourceId: string,
//   requesterId: string
// ): Promise<void> {
//   if (resourceId !== requesterId) {
//     throw operationForbidden;
//   }
// }

// async function assertResourceAllowed(
//   resourceId: string,
//   authData: AuthData
// ): Promise<void> {
//   const roles = authData.userRoles;
//   const organizationId = authData.organizationId;

//   await assertRequesterAllowed(resourceId, organizationId);

//   if (!roles.includes(userRoles.INTERNAL_ROLE)) {
//     throw operationForbidden;
//   }
// }
