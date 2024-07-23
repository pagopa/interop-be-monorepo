import { certifiedAttributesSatisfied } from "pagopa-interop-agreement-lifecycle";
import {
  agreementApi,
  catalogApi,
  tenantApi,
} from "pagopa-interop-api-clients";
import { TenantId } from "pagopa-interop-models";
import { toDescriptorWithOnlyAttributes } from "./api/converters/catalogClientApiConverter.js";
import { toTenantWithOnlyAttributes } from "./api/converters/tenantClientApiConverters.js";
import { invalidEServiceRequester } from "./domain/errors.js";
import {
  agreementApiState,
  catalogApiDescriptorState,
} from "./api/apiTypes.js";

const SUBSCRIBED_AGREEMENT_STATES: agreementApi.AgreementState[] = [
  agreementApiState.PENDING,
  agreementApiState.ACTIVE,
  agreementApiState.SUSPENDED,
];

export const catalogProcessApiEServiceDescriptorCertifiedAttributesSatisfied = (
  descriptor: catalogApi.EServiceDescriptor | undefined,
  tenant: tenantApi.Tenant
): boolean =>
  descriptor !== undefined &&
  certifiedAttributesSatisfied(
    toDescriptorWithOnlyAttributes(descriptor),
    toTenantWithOnlyAttributes(tenant)
  );

export function isAgreementSubscribed(
  agreement: agreementApi.Agreement | undefined
): boolean {
  return !!agreement && SUBSCRIBED_AGREEMENT_STATES.includes(agreement.state);
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

export function isRequesterEserviceProducer(
  requesterId: string,
  eservice: catalogApi.EService
): boolean {
  return requesterId === eservice.producerId;
}

export function validateRequesterId(
  requesterId: TenantId,
  eservice: catalogApi.EService
): void {
  if (!isRequesterEserviceProducer(requesterId, eservice)) {
    throw invalidEServiceRequester(eservice.id, requesterId);
  }
}
