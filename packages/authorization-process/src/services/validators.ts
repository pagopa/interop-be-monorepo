import { JsonWebKey } from "crypto";
import {
  M2MAdminAuthData,
  M2MAuthData,
  UIAuthData,
  hasAtLeastOneUserRole,
  isUiAuthData,
  userRole,
  UserRole,
} from "pagopa-interop-commons";
import {
  Client,
  ClientId,
  clientKind,
  CorrelationId,
  Delegation,
  delegationKind,
  delegationState,
  EService,
  genericError,
  ProducerKeychain,
  ProducerKeychainId,
  Purpose,
  TenantId,
  UserId,
} from "pagopa-interop-models";
import { SelfcareV2InstitutionClient } from "pagopa-interop-api-clients";
import {
  userWithoutSecurityPrivileges,
  tenantNotAllowedOnPurpose,
  tenantNotAllowedOnProducerKeychain,
  tooManyKeysPerClient,
  tooManyKeysPerProducerKeychain,
  tenantNotAllowedOnEService,
  keyAlreadyExists,
  securityUserNotMember,
  clientKindNotAllowed,
  clientAdminIdNotFound,
  tenantNotAllowedOnClient,
} from "../model/domain/errors.js";
import { config } from "../config/config.js";
import { ReadModelServiceSQL } from "./readModelServiceSQL.js";

export const assertUserSelfcareSecurityPrivileges = async ({
  selfcareId,
  requesterUserId,
  consumerId,
  selfcareV2InstitutionClient,
  userIdToCheck,
  correlationId,
  userRolesToCheck,
}: {
  selfcareId: string;
  requesterUserId: UserId;
  consumerId: TenantId;
  selfcareV2InstitutionClient: SelfcareV2InstitutionClient;
  userIdToCheck: UserId;
  correlationId: CorrelationId;
  userRolesToCheck: UserRole[];
}): Promise<void> => {
  const users =
    await selfcareV2InstitutionClient.getInstitutionUsersByProductUsingGET({
      params: { institutionId: selfcareId },
      queries: {
        userId: userIdToCheck,
        productRoles: userRolesToCheck.join(","),
      },
      headers: {
        "X-Correlation-Id": correlationId,
      },
    });
  if (users.length === 0) {
    throw userWithoutSecurityPrivileges(consumerId, requesterUserId);
  }
};

export const assertOrganizationIsClientConsumer = (
  authData: UIAuthData | M2MAuthData | M2MAdminAuthData,
  client: Client
): void => {
  if (client.consumerId !== authData.organizationId) {
    throw tenantNotAllowedOnClient(authData.organizationId, client.id);
  }
};

export const assertOrganizationIsPurposeConsumer = (
  authData: UIAuthData | M2MAdminAuthData,
  purpose: Purpose
): void => {
  if (authData.organizationId !== purpose.consumerId) {
    throw tenantNotAllowedOnPurpose(authData.organizationId, purpose.id);
  }
};

export const assertRequesterIsDelegateConsumer = (
  authData: UIAuthData | M2MAdminAuthData,
  purpose: Purpose,
  delegation: Delegation
): void => {
  if (
    delegation.delegateId !== authData.organizationId ||
    delegation.delegatorId !== purpose.consumerId ||
    delegation.eserviceId !== purpose.eserviceId ||
    delegation.kind !== delegationKind.delegatedConsumer ||
    delegation.state !== delegationState.active
  ) {
    throw tenantNotAllowedOnPurpose(
      authData.organizationId,
      purpose.id,
      delegation.id
    );
  }
};

export const assertOrganizationIsProducerKeychainProducer = (
  authData: UIAuthData | M2MAuthData | M2MAdminAuthData,
  producerKeychain: ProducerKeychain
): void => {
  if (producerKeychain.producerId !== authData.organizationId) {
    throw tenantNotAllowedOnProducerKeychain(
      authData.organizationId,
      producerKeychain.id
    );
  }
};

export const assertClientKeysCountIsBelowThreshold = (
  clientId: ClientId,
  size: number
): void => {
  if (size > config.maxKeysPerClient) {
    throw tooManyKeysPerClient(clientId, size);
  }
};

export const assertProducerKeychainKeysCountIsBelowThreshold = (
  producerKeychainId: ProducerKeychainId,
  size: number
): void => {
  if (size > config.maxKeysPerProducerKeychain) {
    throw tooManyKeysPerProducerKeychain(producerKeychainId, size);
  }
};

export const assertOrganizationIsEServiceProducer = (
  authData: UIAuthData | M2MAdminAuthData,
  eservice: EService
): void => {
  if (authData.organizationId !== eservice.producerId) {
    throw tenantNotAllowedOnEService(authData.organizationId, eservice.id);
  }
};

export const assertKeyDoesNotAlreadyExist = async (
  kid: string,
  readModelService: ReadModelServiceSQL
): Promise<void> => {
  const [clientKey, producerKey] = await Promise.all([
    readModelService.getClientKeyByKid(kid),
    readModelService.getProducerKeychainKeyByKid(kid),
  ]);

  if (clientKey || producerKey) {
    throw keyAlreadyExists(kid);
  }
};

export const assertSecurityRoleIsClientMember = (
  authData: UIAuthData | M2MAuthData | M2MAdminAuthData,
  client: Client
): void => {
  if (
    isUiAuthData(authData) &&
    hasAtLeastOneUserRole(authData, [userRole.SECURITY_ROLE]) &&
    !client.users.includes(authData.userId)
  ) {
    throw securityUserNotMember(authData.userId);
  }
};

export function assertClientIsConsumer(
  client: Client
): asserts client is Client & { kind: typeof clientKind.consumer } {
  if (client.kind !== clientKind.consumer) {
    throw clientKindNotAllowed(client.id);
  }
}

export function assertClientIsAPI(
  client: Client
): asserts client is Client & { kind: typeof clientKind.api } {
  if (client.kind !== clientKind.api) {
    throw clientKindNotAllowed(client.id);
  }
}

export const assertAdminInClient = (client: Client, adminId: UserId): void => {
  if (client.adminId !== adminId) {
    throw clientAdminIdNotFound(client.id, adminId);
  }
};

export function assertJwkKtyIsDefined(
  jwk: JsonWebKey
): asserts jwk is JsonWebKey & { kty: NonNullable<JsonWebKey["kty"]> } {
  if (jwk.kty === undefined) {
    throw genericError("JWK must have a 'kty' property");
  }
}
