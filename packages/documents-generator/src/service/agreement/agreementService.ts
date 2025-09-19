import {
  TenantId,
  Tenant,
  DescriptorId,
  EService,
  Descriptor,
  Agreement,
} from "pagopa-interop-models";
import { ReadModelService } from "../readModelService.js";
import { ActiveDelegations } from "../../model/agreementModels.js";
import { descriptorNotFound, tenantNotFound } from "../../model/errors.js";

export const retrieveTenant = async (
  tenantId: TenantId,
  readModelService: ReadModelService
): Promise<Tenant> => {
  const tenant = await readModelService.getTenantById(tenantId);
  if (!tenant) {
    throw tenantNotFound(tenantId);
  }
  return tenant;
};

export const retrieveDescriptor = (
  descriptorId: DescriptorId,
  eservice: EService
): Descriptor => {
  const descriptor = eservice.descriptors.find(
    (d: Descriptor) => d.id === descriptorId
  );

  if (!descriptor) {
    throw descriptorNotFound(eservice.id, descriptorId);
  }

  return descriptor;
};

export const getActiveConsumerAndProducerDelegations = async (
  agreement: Agreement,
  readModelService: ReadModelService,
  cachedActiveDelegations?: ActiveDelegations
): Promise<ActiveDelegations> => ({
  producerDelegation:
    cachedActiveDelegations?.producerDelegation ??
    (await readModelService.getActiveProducerDelegationByEserviceId(
      agreement.eserviceId
    )),
  consumerDelegation:
    cachedActiveDelegations?.consumerDelegation ??
    (await readModelService.getActiveConsumerDelegationByAgreement(agreement)),
});
