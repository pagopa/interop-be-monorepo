import {
  EService,
  Descriptor,
  descriptorState,
  Tenant,
  TenantId,
} from "pagopa-interop-models";

import { ReadModelServiceSQL } from "../services/readModelServiceSQL.js";
import {
  descriptorPublishedNotFound,
  tenantNotFound,
} from "../models/errors.js";

export async function retrieveTenant(
  tenantId: TenantId,
  readModelService: ReadModelServiceSQL
): Promise<Tenant> {
  const tenant = await readModelService.getTenantById(tenantId);
  if (!tenant) {
    throw tenantNotFound(tenantId);
  }
  return tenant;
}

export function retrieveLatestPublishedDescriptor(
  eservice: EService
): Descriptor {
  const latestDescriptor = eservice.descriptors
    .filter((d) => d.state === descriptorState.published)
    .sort((a, b) => Number(a.version) - Number(b.version))
    .at(-1);
  if (!latestDescriptor) {
    throw descriptorPublishedNotFound(eservice.id);
  }
  return latestDescriptor;
}
