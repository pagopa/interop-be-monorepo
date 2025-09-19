import {
  TenantId,
  Tenant,
  genericInternalError,
  EService,
  EServiceId,
  WithMetadata,
  Delegation,
  Purpose,
} from "pagopa-interop-models";
import { ReadModelService } from "../readModelService.js";

export const retrieveTenant = async (
  tenantId: TenantId,
  readModelService: ReadModelService
): Promise<Tenant> => {
  const tenant = await readModelService.getTenantById(tenantId);
  if (tenant === undefined) {
    throw genericInternalError(tenantId); // todo handle right error
  }
  return tenant;
};

export const retrieveEService = async (
  eserviceId: EServiceId,
  readModelService: ReadModelService
): Promise<WithMetadata<EService> | undefined> => {
  const eservice = await readModelService.getEServiceById(eserviceId);
  if (eservice === undefined) {
    throw genericInternalError(eserviceId);
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
    throw genericInternalError(`${purpose.id}, ${purpose.delegationId}`); // todo handle error
  }
  return delegation;
};
