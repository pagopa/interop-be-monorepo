import { EService, EServiceId, Tenant, TenantId } from "pagopa-interop-models";
import { eServiceNotFound, tenantNotFound } from "../../model/errors.js";
import { ReadModelServiceSQL } from "../readModelSql.js";

export const retrieveTenantById = async (
  readModelService: ReadModelServiceSQL,
  tenantId: TenantId
): Promise<Tenant> => {
  const tenant = await readModelService.getTenantById(tenantId);
  if (!tenant) {
    throw tenantNotFound(tenantId);
  }
  return tenant;
};

export const retrieveEserviceById = async (
  readModelService: ReadModelServiceSQL,
  id: EServiceId
): Promise<EService> => {
  const eservice = await readModelService.getEServiceById(id);
  if (!eservice) {
    throw eServiceNotFound(id);
  }
  return eservice.data;
};
