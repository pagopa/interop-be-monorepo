import {
  TenantId,
  Tenant,
  EService,
  EServiceId,
  WithMetadata,
  Delegation,
  Purpose,
} from "pagopa-interop-models";
import {
  eServiceNotFound,
  purposeDelegationNotFound,
  tenantNotFound,
} from "../../model/errors.js";
import { ReadModelServiceSQL } from "../readModelSql.js";

export const retrieveTenant = async (
  tenantId: TenantId,
  readModelService: ReadModelServiceSQL
): Promise<Tenant> => {
  const tenant = await readModelService.getTenantById(tenantId);
  if (tenant === undefined) {
    throw tenantNotFound(tenantId);
  }
  return tenant;
};

export const retrieveEService = async (
  eserviceId: EServiceId,
  readModelService: ReadModelServiceSQL
): Promise<WithMetadata<EService> | undefined> => {
  const eservice = await readModelService.getEServiceById(eserviceId);
  if (eservice === undefined) {
    throw eServiceNotFound(eserviceId);
  }
  return eservice;
};

export const retrievePurposeDelegation = async (
  purpose: Purpose,
  readModelService: ReadModelServiceSQL
): Promise<Delegation | undefined> => {
  if (!purpose.delegationId) {
    return undefined;
  }
  const delegation =
    await readModelService.getActiveConsumerDelegationByDelegationId(
      purpose.delegationId
    );
  if (!delegation) {
    throw purposeDelegationNotFound(purpose.id, purpose.delegationId);
  }
  return delegation;
};
