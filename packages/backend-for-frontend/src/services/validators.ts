import { certifiedAttributesSatisfied } from "pagopa-interop-agreement-lifecycle";
import {
  agreementApi,
  authorizationApi,
  catalogApi,
  delegationApi,
  tenantApi,
} from "pagopa-interop-api-clients";
import {
  delegationKind,
  delegationState,
  EServiceId,
  EServiceTemplateId,
  TenantId,
  unauthorizedError,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { descriptorAttributesFromApi } from "../api/catalogApiConverter.js";
import {
  toDelegationKind,
  toDelegationState,
} from "../api/delegationApiConverter.js";
import { tenantAttributesFromApi } from "../api/tenantApiConverter.js";
import {
  delegatedEserviceNotExportable,
  invalidEServiceRequester,
  notValidDescriptor,
  templateInstanceNotAllowed,
} from "../model/errors.js";
import {
  agreementApiState,
  catalogApiDescriptorState,
} from "../model/types.js";
import { BffAppContext } from "../utilities/context.js";
import { getAllDelegations } from "./delegationService.js";

export function isValidDescriptor(
  descriptor: catalogApi.EServiceDescriptor
): boolean {
  return match(descriptor.state)
    .with(
      catalogApi.EServiceDescriptorState.Values.ARCHIVED,
      catalogApi.EServiceDescriptorState.Values.DEPRECATED,
      catalogApi.EServiceDescriptorState.Values.PUBLISHED,
      catalogApi.EServiceDescriptorState.Values.SUSPENDED,
      () => true
    )
    .with(
      catalogApi.EServiceDescriptorState.Values.DRAFT,
      catalogApi.EServiceDescriptorState.Values.WAITING_FOR_APPROVAL,
      () => false
    )
    .exhaustive();
}

export function isInvalidDescriptor(
  descriptor: catalogApi.EServiceDescriptor
): boolean {
  return match(descriptor.state)
    .with(
      catalogApi.EServiceDescriptorState.Values.DRAFT,
      catalogApi.EServiceDescriptorState.Values.WAITING_FOR_APPROVAL,
      () => true
    )
    .with(
      catalogApi.EServiceDescriptorState.Values.ARCHIVED,
      catalogApi.EServiceDescriptorState.Values.DEPRECATED,
      catalogApi.EServiceDescriptorState.Values.PUBLISHED,
      catalogApi.EServiceDescriptorState.Values.SUSPENDED,
      () => false
    )
    .exhaustive();
}

export function isRequesterEserviceProducer(
  requesterId: string,
  eservice: catalogApi.EService
): boolean {
  return requesterId === eservice.producerId;
}

export function assertRequesterIsProducer(
  requesterId: TenantId,
  eservice: catalogApi.EService
): void {
  if (!isRequesterEserviceProducer(requesterId, eservice)) {
    throw invalidEServiceRequester(eservice.id, requesterId);
  }
}

export async function assertRequesterCanActAsProducer(
  delegationProcessClient: delegationApi.DelegationProcessClient,
  headers: BffAppContext["headers"],
  requesterId: TenantId,
  eservice: catalogApi.EService
): Promise<void> {
  try {
    assertRequesterIsProducer(requesterId, eservice);
  } catch {
    const producerDelegations = await getAllDelegations(
      delegationProcessClient,
      headers,
      {
        kind: toDelegationKind(delegationKind.delegatedProducer),
        delegateIds: [requesterId],
        eserviceIds: [eservice.id],
        delegationStates: [toDelegationState(delegationState.active)],
      }
    );
    if (producerDelegations.length === 0) {
      throw invalidEServiceRequester(eservice.id, requesterId);
    }
  }
}

export async function assertNotDelegatedEservice(
  delegationProcessClient: delegationApi.DelegationProcessClient,
  headers: BffAppContext["headers"],
  delegatorId: TenantId,
  eserviceId: EServiceId
): Promise<void> {
  const delegations = await getAllDelegations(
    delegationProcessClient,
    headers,
    {
      kind: toDelegationKind(delegationKind.delegatedProducer),
      delegatorIds: [delegatorId],
      eserviceIds: [eserviceId],
      delegationStates: [
        toDelegationState(delegationState.active),
        toDelegationState(delegationState.waitingForApproval),
      ],
    }
  );

  if (delegations.length > 0) {
    throw delegatedEserviceNotExportable(delegatorId);
  }
}

export function isAgreementUpgradable(
  eservice: catalogApi.EService,
  agreement: agreementApi.Agreement
): boolean {
  const eserviceDescriptor = eservice.descriptors.find(
    (e) => e.id === agreement.descriptorId
  );

  return (
    eserviceDescriptor !== undefined &&
    eservice.descriptors
      .filter((d) => Number(d.version) > Number(eserviceDescriptor.version))
      .find(
        (d) =>
          (d.state === catalogApiDescriptorState.PUBLISHED ||
            d.state === catalogApiDescriptorState.SUSPENDED) &&
          (agreement.state === agreementApiState.ACTIVE ||
            agreement.state === agreementApiState.SUSPENDED)
      ) !== undefined
  );
}

export function isAgreementSubscribed(
  agreement: agreementApi.Agreement | undefined
): boolean {
  return match(agreement?.state)
    .with(
      agreementApiState.PENDING,
      agreementApiState.ACTIVE,
      agreementApiState.SUSPENDED,
      () => true
    )
    .with(
      agreementApiState.REJECTED,
      agreementApiState.ARCHIVED,
      agreementApiState.MISSING_CERTIFIED_ATTRIBUTES,
      agreementApiState.DRAFT,
      () => false
    )
    .with(undefined, () => false)
    .exhaustive();
}

export function hasCertifiedAttributes(
  descriptor: catalogApi.EServiceDescriptor | undefined,
  requesterTenant: tenantApi.Tenant
): boolean {
  return (
    descriptor !== undefined &&
    certifiedAttributesSatisfied(
      descriptorAttributesFromApi(descriptor.attributes),
      tenantAttributesFromApi(requesterTenant.attributes)
    )
  );
}

export function verifyExportEligibility(
  descriptor: catalogApi.EServiceDescriptor
): void {
  if (!isValidDescriptor(descriptor)) {
    throw notValidDescriptor(descriptor.id, descriptor.state);
  }
}

export function assertEServiceNotTemplateInstance(
  eservice: catalogApi.EService
): asserts eservice is catalogApi.EService & {
  templateId: EServiceTemplateId | undefined;
} {
  const templateId = eservice.templateId;
  if (templateId !== undefined) {
    throw templateInstanceNotAllowed(eservice.id, templateId);
  }
}

export function assertClientVisibilityIsFull(
  client: authorizationApi.Client
): asserts client is authorizationApi.Client & {
  visibility: typeof authorizationApi.Visibility.Values.FULL;
} {
  if (client.visibility !== authorizationApi.Visibility.Values.FULL) {
    throw unauthorizedError("Tenant is not the owner of the client");
  }
}

export function assertProducerKeychainVisibilityIsFull(
  keychain: authorizationApi.ProducerKeychain
): asserts keychain is authorizationApi.ProducerKeychain & {
  visibility: typeof authorizationApi.Visibility.Values.FULL;
} {
  if (keychain.visibility !== authorizationApi.Visibility.Values.FULL) {
    throw unauthorizedError("Tenant is not the owner of the keychain");
  }
}

export function assertRequesterCanRetrieveUsers(
  requesterId: TenantId,
  tenantId: TenantId
): void {
  if (requesterId !== tenantId) {
    throw unauthorizedError(
      `Requester ${requesterId} cannot retrieve users for tenant ${tenantId}`
    );
  }
}
