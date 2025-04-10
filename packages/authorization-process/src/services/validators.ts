import {
  M2MAuthData,
  UIAuthData,
  hasAtLeastOneUserRole,
  isUiAuthData,
  userRole,
} from "pagopa-interop-commons";
import {
  Client,
  ClientId,
  CorrelationId,
  Delegation,
  delegationKind,
  delegationState,
  EService,
  ProducerKeychain,
  ProducerKeychainId,
  Purpose,
  TenantId,
  UserId,
} from "pagopa-interop-models";
import { SelfcareV2InstitutionClient } from "pagopa-interop-api-clients";
import {
  userWithoutSecurityPrivileges,
  organizationNotAllowedOnPurpose,
  organizationNotAllowedOnClient,
  organizationNotAllowedOnProducerKeychain,
  tooManyKeysPerClient,
  tooManyKeysPerProducerKeychain,
  organizationNotAllowedOnEService,
  keyAlreadyExists,
  securityUserNotMember,
} from "../model/domain/errors.js";
import { config } from "../config/config.js";
import { ReadModelService } from "./readModelService.js";

export const assertUserSelfcareSecurityPrivileges = async ({
  selfcareId,
  requesterUserId,
  consumerId,
  selfcareV2InstitutionClient,
  userIdToCheck,
  correlationId,
}: {
  selfcareId: string;
  requesterUserId: UserId;
  consumerId: TenantId;
  selfcareV2InstitutionClient: SelfcareV2InstitutionClient;
  userIdToCheck: UserId;
  correlationId: CorrelationId;
}): Promise<void> => {
  const users =
    await selfcareV2InstitutionClient.getInstitutionUsersByProductUsingGET({
      params: { institutionId: selfcareId },
      queries: {
        userId: userIdToCheck,
        productRoles: [userRole.ADMIN_ROLE, userRole.SECURITY_ROLE].join(","),
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
  authData: UIAuthData | M2MAuthData,
  client: Client
): void => {
  if (client.consumerId !== authData.organizationId) {
    throw organizationNotAllowedOnClient(authData.organizationId, client.id);
  }
};

export const assertOrganizationIsPurposeConsumer = (
  authData: UIAuthData,
  purpose: Purpose
): void => {
  if (authData.organizationId !== purpose.consumerId) {
    throw organizationNotAllowedOnPurpose(authData.organizationId, purpose.id);
  }
};

export const assertRequesterIsDelegateConsumer = (
  authData: UIAuthData,
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
    throw organizationNotAllowedOnPurpose(
      authData.organizationId,
      purpose.id,
      delegation.id
    );
  }
};

export const assertOrganizationIsProducerKeychainProducer = (
  authData: UIAuthData | M2MAuthData,
  producerKeychain: ProducerKeychain
): void => {
  if (producerKeychain.producerId !== authData.organizationId) {
    throw organizationNotAllowedOnProducerKeychain(
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
  authData: UIAuthData,
  eservice: EService
): void => {
  if (authData.organizationId !== eservice.producerId) {
    throw organizationNotAllowedOnEService(
      authData.organizationId,
      eservice.id
    );
  }
};

export const assertKeyDoesNotAlreadyExist = async (
  kid: string,
  readModelService: ReadModelService
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
  authData: UIAuthData | M2MAuthData,
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
