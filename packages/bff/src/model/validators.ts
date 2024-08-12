import { certifiedAttributesSatisfied } from "pagopa-interop-agreement-lifecycle";
import {
  agreementApi,
  catalogApi,
  tenantApi,
} from "pagopa-interop-api-clients";
import { TenantId } from "pagopa-interop-models";
import { toDescriptorWithOnlyAttributes } from "./api/converters/catalogClientApiConverter.js";
import { toTenantWithOnlyAttributes } from "./api/converters/tenantClientApiConverters.js";
import {
  invalidEServiceRequester,
  notValidDescriptor,
} from "./domain/errors.js";
import {
  agreementApiState,
  catalogApiDescriptorState,
} from "./api/apiTypes.js";

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
      toDescriptorWithOnlyAttributes(descriptor),
      toTenantWithOnlyAttributes(requesterTenant)
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
