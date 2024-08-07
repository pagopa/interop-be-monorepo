import { certifiedAttributesSatisfied } from "pagopa-interop-agreement-lifecycle";
import { catalogApi, tenantApi } from "pagopa-interop-api-clients";
import { TenantId } from "pagopa-interop-models";
import { toDescriptorWithOnlyAttributes } from "./api/converters/catalogClientApiConverter.js";
import { toTenantWithOnlyAttributes } from "./api/converters/tenantClientApiConverters.js";
import {
  invalidEServiceRequester,
  notValidDescriptor,
} from "./domain/errors.js";
import { catalogApiDescriptorState } from "./api/apiTypes.js";

export const catalogProcessApiEServiceDescriptorCertifiedAttributesSatisfied = (
  descriptor: catalogApi.EServiceDescriptor | undefined,
  tenant: tenantApi.Tenant
): boolean =>
  descriptor !== undefined &&
  certifiedAttributesSatisfied(
    toDescriptorWithOnlyAttributes(descriptor),
    toTenantWithOnlyAttributes(tenant)
  );

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

export function verifyExportEligibility(
  descriptor: catalogApi.EServiceDescriptor
): void {
  if (descriptor.state === catalogApiDescriptorState.DRAFT) {
    throw notValidDescriptor(descriptor.id, descriptor.state);
  }
}
