import {
  EService,
  EServiceId,
  Tenant,
  TenantId,
  genericInternalError,
} from "pagopa-interop-models";
import { ReadModelService } from "../readModelService.js";

export const retrieveTenantById = async (
  readModelService: ReadModelService,
  tenantId: TenantId
): Promise<Tenant> => {
  const tenant = await readModelService.getTenantById(tenantId);
  if (!tenant) {
    throw genericInternalError(`Tenant ${tenantId} not found`);
  }
  return tenant;
};

export const retrieveEserviceById = async (
  readModelService: ReadModelService,
  id: EServiceId
): Promise<EService> => {
  const eservice = await readModelService.getEServiceById(id);
  if (!eservice) {
    throw genericInternalError(`Eservice ${eservice} not found`);
  }
  return eservice.data;
};
