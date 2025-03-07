import { certifiedAttributesSatisfied } from "pagopa-interop-agreement-lifecycle";
import {
  agreementApi,
  catalogApi,
  delegationApi,
  eserviceTemplateApi,
  tenantApi,
} from "pagopa-interop-api-clients";
import {
  delegationKind,
  delegationState,
  EServiceId,
  EServiceTemplateVersionId,
  TenantId,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { descriptorAttributesFromApi } from "../api/catalogApiConverter.js";
import {
  toDelegationKind,
  toDelegationState,
} from "../api/delegationApiConverter.js";
import { tenantAttributesFromApi } from "../api/tenantApiConverter.js";
import { DelegationProcessClient } from "../clients/clientsProvider.js";
import {
  delegatedEserviceNotExportable,
  eserviceIsNotDraft,
  eserviceTemplateNotPublished,
  invalidEServiceRequester,
  notValidDescriptor,
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

export function verifyRequesterIsProducerOrDelegateProducer(
  requesterId: TenantId,
  eservice: catalogApi.EService,
  activeProducerDelegations: delegationApi.Delegation[] | undefined
): void {
  if (
    !isRequesterEserviceProducer(requesterId, eservice) &&
    !isRequesterProducerDelegate(
      eservice,
      requesterId,
      activeProducerDelegations
    )
  ) {
    throw invalidEServiceRequester(eservice.id, requesterId);
  }
}

export function isRequesterProducerDelegate(
  eservice: catalogApi.EService,
  requesterId: TenantId,
  activeProducerDelegations: delegationApi.Delegation[] | undefined
): boolean {
  const producerDelegation = activeProducerDelegations?.at(0);
  return (
    producerDelegation?.delegateId === requesterId &&
    producerDelegation?.delegatorId === eservice.producerId &&
    producerDelegation?.kind ===
      delegationApi.DelegationKind.Values.DELEGATED_PRODUCER &&
    producerDelegation?.state === delegationApi.DelegationState.Values.ACTIVE &&
    producerDelegation?.eserviceId !== eservice.id
  );
}

export async function assertRequesterCanActAsProducer(
  delegationProcessClient: DelegationProcessClient,
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
  delegationProcessClient: DelegationProcessClient,
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

export function assertIsDraftEservice(eservice: catalogApi.EService): void {
  if (
    eservice.descriptors.some(
      (d) => d.state !== catalogApi.EServiceDescriptorState.Values.DRAFT
    )
  ) {
    throw eserviceIsNotDraft(eservice.id);
  }
}

export function assertTemplateIsPublished(
  template: eserviceTemplateApi.EServiceTemplate,
  versionId: EServiceTemplateVersionId
): void {
  const templateVersion = template.versions.find((v) => v.id === versionId);
  if (
    templateVersion?.state !==
    eserviceTemplateApi.EServiceTemplateVersionState.Values.PUBLISHED
  ) {
    throw eserviceTemplateNotPublished(template.id);
  }
}
