import {
  Agreement,
  AgreementV2,
  EService,
  EServiceV2,
  NotificationConfig,
  TenantId,
} from "pagopa-interop-models";
import { ReadModelServiceSQL } from "../services/readModelServiceSQL.js";
import { UserServiceSQL } from "../services/userServiceSQL.js";
import { HandlerCommonParams } from "../models/handlerParams.js";
import { eServiceNotFound } from "../models/errors.js";

export async function getUserEmailsToNotify(
  tenantId: TenantId,
  notificationName: keyof NotificationConfig,
  readModelService: ReadModelServiceSQL,
  userService: UserServiceSQL
): Promise<string[]> {
  const tenantUsers =
    await readModelService.getTenantUsersWithNotificationEnabled(
      [tenantId],
      notificationName
    );

  const usersToNotify = await userService.readUsers(
    tenantUsers.map((config) => config.userId)
  );
  return usersToNotify.map((user) => user.email);
}

export async function retrieveAgreementEservice(
  agreement: Agreement,
  readModelService: ReadModelServiceSQL
): Promise<EService> {
  const eservice = await readModelService.getEServiceById(agreement.eserviceId);

  if (!eservice) {
    throw eServiceNotFound(agreement.eserviceId);
  }

  return eservice;
}

export type AgreementHandlerParams = HandlerCommonParams & {
  agreementV2Msg?: AgreementV2;
};

export type EServiceHandlerParams = HandlerCommonParams & {
  eserviceV2Msg?: EServiceV2;
};
