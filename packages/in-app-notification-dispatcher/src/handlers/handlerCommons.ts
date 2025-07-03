import { Tenant, TenantId } from "pagopa-interop-models";
import { ReadModelService } from "../services/readModelService.js";
import { tenantNotFound } from "../models/errors.js";

export async function retrieveTenant(
  tenantId: TenantId,
  readModelService: ReadModelService
): Promise<Tenant> {
  const tenant = await readModelService.getTenantById(tenantId);
  if (!tenant) {
    throw tenantNotFound(tenantId);
  }
  return tenant;
}
