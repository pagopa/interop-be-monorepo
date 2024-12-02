import { certifiedAttributesSatisfied } from "pagopa-interop-agreement-lifecycle";
import {
  agreementApi,
  catalogApi,
  tenantApi,
} from "pagopa-interop-api-clients";
import {
  delegationKind,
  delegationState,
  EServiceId,
  TenantId,
} from "pagopa-interop-models";
import { descriptorAttributesFromApi } from "../api/catalogApiConverter.js";
import {
  toDelegationKind,
  toDelegationState,
} from "../api/delegationApiConverter.js";
import { tenantAttributesFromApi } from "../api/tenantApiConverter.js";
import { DelegationProcessClient } from "../clients/clientsProvider.js";
import {
  delegatedEserviceNotExportable,
  invalidEServiceRequester,
  notValidDescriptor,
} from "../model/errors.js";
import {
  agreementApiState,
  catalogApiDescriptorState,
} from "../model/types.js";
import { BffAppContext } from "../utilities/context.js";
import { getAllDelegations } from "./delegationService.js";

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

export async function assertNotDelegatedEservice(
  delegationProcessClient: DelegationProcessClient,
  headers: BffAppContext["headers"],
  delegatorId: TenantId,
  eserviceid: EServiceId
): Promise<void> {
  const delegations = await getAllDelegations(
    delegationProcessClient,
    headers,
    {
      kind: toDelegationKind(delegationKind.delegatedProducer),
      delegatorIds: [delegatorId],
      eserviceIds: [eserviceid],
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

const subscribedAgreementStates: agreementApi.AgreementState[] = [
  agreementApiState.PENDING,
  agreementApiState.ACTIVE,
  agreementApiState.SUSPENDED,
];

export function isAgreementSubscribed(
  agreement: agreementApi.Agreement | undefined
): boolean {
  return !!agreement && subscribedAgreementStates.includes(agreement.state);
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
  if (descriptor.state === catalogApiDescriptorState.DRAFT) {
    throw notValidDescriptor(descriptor.id, descriptor.state);
  }
}
