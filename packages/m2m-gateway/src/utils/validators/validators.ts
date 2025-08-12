import {
  TenantId,
  WithMetadata,
  unauthorizedError,
} from "pagopa-interop-models";
import { authorizationApi, delegationApi } from "pagopa-interop-api-clients";
import { WithMaybeMetadata } from "../../clients/zodiosWithMetadataPatch.js";
import {
  missingMetadata,
  notAnActiveConsumerDelegation,
  tenantAuthorizationMismatch,
  unexpectedDelegationKind,
} from "../../model/errors.js";

export function assertMetadataExists<T>(
  resource: WithMaybeMetadata<T>
): asserts resource is WithMetadata<T> {
  if (!resource.metadata) {
    throw missingMetadata();
  }
}

export function assertTargetMetadataExists(
  metadata: { version: number } | undefined
): asserts metadata is { version: number } {
  if (metadata === undefined) {
    throw missingMetadata();
  }
}

export function assertClientVisibilityIsFull(
  client: authorizationApi.Client
): asserts client is authorizationApi.Client & {
  visibility: typeof authorizationApi.Visibility.Values.FULL;
} {
  if (client.visibility !== authorizationApi.Visibility.Values.FULL) {
    throw unauthorizedError(
      `Tenant is not the owner of the client with id ${client.id}`
    );
  }
}

export function assertActiveConsumerDelegateForEservice(
  requesterTenantId: TenantId,
  eserviceId: string,
  delegation: delegationApi.Delegation
): void {
  if (
    delegation.kind !==
      delegationApi.DelegationKind.Values.DELEGATED_CONSUMER ||
    delegation.state !== delegationApi.DelegationState.Values.ACTIVE ||
    delegation.delegateId !== requesterTenantId ||
    delegation.eserviceId !== eserviceId
  ) {
    throw notAnActiveConsumerDelegation(
      requesterTenantId,
      eserviceId,
      delegation
    );
  }
}

export function assertTenantDeclaredAttributeAuthorization(
  callerTenantId: TenantId,
  requestedTenantId: TenantId,
  delegationId?: string,
  delegation?: delegationApi.Delegation
): void {
  // Caller can always operate on their own declared attributes
  if (callerTenantId === requestedTenantId) {
    return;
  }

  // If no delegationId is provided for different tenants, throw authorization error
  if (!delegationId) {
    throw tenantAuthorizationMismatch(
      callerTenantId,
      requestedTenantId,
      delegationId
    );
  }

  // If delegation is provided, validate it
  if (
    delegation &&
    (delegation.kind !==
      delegationApi.DelegationKind.Values.DELEGATED_PRODUCER ||
      delegation.state !== delegationApi.DelegationState.Values.ACTIVE ||
      delegation.delegateId !== callerTenantId ||
      delegation.delegatorId !== requestedTenantId)
  ) {
    throw unexpectedDelegationKind(delegation);
  }
}
