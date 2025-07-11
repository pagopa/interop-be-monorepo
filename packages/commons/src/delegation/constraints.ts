import {
  DelegationId,
  Delegation,
  TenantId,
  badRequestError,
  unauthorizedError,
} from "pagopa-interop-models";
import { UIAuthData, M2MAdminAuthData } from "../auth/authData.js";

export type ActiveDelegations = {
  producerDelegation: Delegation | undefined;
  consumerDelegation: Delegation | undefined;
};

const validateWithDelegationId = (
  delegationId: DelegationId,
  activeDelegations: ActiveDelegations,
  authData: UIAuthData | M2MAdminAuthData
): Delegation => {
  const matchingDelegation = [
    activeDelegations.consumerDelegation,
    activeDelegations.producerDelegation,
  ].find((d) => d?.id === delegationId);

  if (!matchingDelegation) {
    throw unauthorizedError(
      `Tenant ${authData.organizationId} is not allowed to perform the operation because is neither producer/consumer nor delegate`
    );
  }
  return matchingDelegation;
};

const validateWithoutDelegationId = (
  activeDelegations: ActiveDelegations,
  consumerId: TenantId,
  producerId: TenantId,
  { organizationId }: UIAuthData | M2MAdminAuthData
): undefined => {
  const isConsumer = organizationId === consumerId;
  const isProducer = organizationId === producerId;

  if (!isConsumer && !isProducer) {
    throw badRequestError(
      `Tenant ${organizationId} is not allowed to perform the operation because the delegation ID is missing`
    );
  }

  const hasDelegation =
    (isConsumer && activeDelegations.consumerDelegation) ||
    (isProducer && activeDelegations.producerDelegation);

  if (hasDelegation) {
    throw badRequestError(
      `Tenant ${organizationId} is not allowed to perform the operation because the delegation ID is missing`
    );
  }
  return undefined;
};

export const validateDelegationConstraints = async ({
  delegationId,
  consumerId,
  producerId,
  authData,
  activeDelegations,
}: {
  delegationId: DelegationId | undefined;
  consumerId: TenantId;
  producerId: TenantId;
  authData: UIAuthData | M2MAdminAuthData;
  activeDelegations: ActiveDelegations;
}): Promise<Delegation | undefined> =>
  delegationId
    ? validateWithDelegationId(delegationId, activeDelegations, authData)
    : validateWithoutDelegationId(
        activeDelegations,
        consumerId,
        producerId,
        authData
      );
