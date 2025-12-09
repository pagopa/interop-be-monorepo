import {
  TenantId,
  Tenant,
  DescriptorId,
  EService,
  Descriptor,
  Agreement,
  EServiceId,
} from "pagopa-interop-models";
import { ActiveDelegations } from "../../model/agreementModels.js";
import {
  descriptorNotFound,
  eServiceNotFound,
  tenantNotFound,
} from "../../model/errors.js";
import { ReadModelServiceSQL } from "../readModelSql.js";

export const retrieveTenant = async (
  readModelService: ReadModelServiceSQL,
  tenantId: TenantId
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

export const retrieveEservice = async (
  readModelService: ReadModelServiceSQL,
  id: EServiceId
): Promise<EService> => {
  const eservice = await readModelService.getEServiceById(id);
  if (!eservice) {
    throw eServiceNotFound(id);
  }
  return eservice.data;
};

export const getActiveConsumerAndProducerDelegations = async (
  agreement: Agreement,
  readModelService: ReadModelServiceSQL
): Promise<ActiveDelegations> => ({
  producerDelegation:
    await readModelService.getActiveProducerDelegationByEserviceId(
      agreement.eserviceId
    ),
  consumerDelegation:
    await readModelService.getActiveConsumerDelegationByAgreement(agreement),
});
