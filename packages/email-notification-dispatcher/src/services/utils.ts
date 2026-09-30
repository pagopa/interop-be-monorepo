import {
  EmailNotificationMessagePayload,
  EService,
  EServiceId,
  Tenant,
  TenantId,
} from "pagopa-interop-models";
import {
  tenantNotFound,
  eserviceNotFound,
} from "pagopa-interop-notification-commons";
import { match } from "ts-pattern";

import { ReadModelServiceSQL } from "./readModelServiceSQL.js";

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

export const retrieveEService = async (
  eserviceId: EServiceId,
  readModelService: ReadModelServiceSQL
): Promise<EService> => {
  const eservice = await readModelService.getEServiceById(eserviceId);
  if (!eservice) {
    throw eserviceNotFound(eserviceId);
  }
  return eservice;
};

export function encodeEmailEvent(
  event: EmailNotificationMessagePayload
): string {
  return JSON.stringify({
    correlationId: event.correlationId,
    email: {
      subject: event.email.subject,
      body: event.email.body,
    },
    tenantId: event.tenantId,
    ...match(event)
      .with({ type: "User" }, ({ type, userId }) => ({ type, userId }))
      .with({ type: "Tenant" }, ({ type, address }) => ({ type, address }))
      .exhaustive(),
  });
}
