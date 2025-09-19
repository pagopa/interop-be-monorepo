import {
  TenantId,
  Tenant,
  EService,
  EServiceId,
  WithMetadata,
  Delegation,
  Purpose,
} from "pagopa-interop-models";
import { ReadModelService } from "../readModelService.js";
import {
  eServiceNotFound,
  purposeDelegationNotFound,
  tenantNotFound,
} from "../../model/errors.js";

export const retrieveTenant = async (
  tenantId: TenantId,
  readModelService: ReadModelService
): Promise<Tenant> => {
  const tenant = await readModelService.getTenantById(tenantId);
  if (tenant === undefined) {
    throw tenantNotFound(tenantId);
  }
  return tenant;
};

export const retrieveEService = async (
  eserviceId: EServiceId,
  readModelService: ReadModelService
): Promise<WithMetadata<EService> | undefined> => {
  const eservice = await readModelService.getEServiceById(eserviceId);
  if (eservice === undefined) {
    throw eServiceNotFound(eserviceId);
  }
  return eservice;
};

export const retrievePurposeDelegation = async (
  purpose: Purpose,
  readModelService: ReadModelService
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
