import {
  Agreement,
  AgreementV2,
  EService,
  EServiceV2,
  NotificationConfig,
  NotificationType,
  Tenant,
  TenantId,
  tenantMailKind,
} from "pagopa-interop-models";
import { getLatestTenantMailOfKind, Logger } from "pagopa-interop-commons";
import { ReadModelServiceSQL } from "../services/readModelServiceSQL.js";
import { UserServiceSQL } from "../services/userServiceSQL.js";
import { HandlerCommonParams } from "../models/handlerParams.js";
import { eServiceNotFound } from "../models/errors.js";

export type AgreementHandlerParams = HandlerCommonParams & {
  agreementV2Msg?: AgreementV2;
};

export type EServiceHandlerParams = HandlerCommonParams & {
  eserviceV2Msg?: EServiceV2;
};

type EmailNotificationRecipient = {
  type: "Tenant" | "User";
  tenantName: string;
  address: string;
};

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

const getTenantContactEmailIfEnabled = async (
  tenant: Tenant,
  readModelService: ReadModelServiceSQL,
  logger: Logger
): Promise<string | undefined> => {
  const tenantConfig =
    await readModelService.getTenantNotificationConfigByTenantId(tenant.id);
  if (tenantConfig === undefined) {
    logger.warn(`No notification configuration found for tenant ${tenant.id}.`);
    return undefined;
  }
  if (tenantConfig.enabled === false) {
    return undefined;
  }
  const email = getLatestTenantMailOfKind(
    tenant.mails,
    tenantMailKind.ContactEmail
  );
  if (email === undefined) {
    logger.warn(`No contact email found for tenant ${tenant.id}.`);
    return undefined;
  }
  return email.address;
};

export const getRecipientsForTenants = async ({
  tenants,
  notificationType,
  includeTenantContactEmails,
  readModelService,
  userService,
  logger,
}: {
  tenants: Tenant[];
  notificationType: NotificationType;
  includeTenantContactEmails: boolean;
  readModelService: ReadModelServiceSQL;
  userService: UserServiceSQL;
  logger: Logger;
}): Promise<EmailNotificationRecipient[]> => {
  const tenantUsers =
    await readModelService.getTenantUsersWithNotificationEnabled(
      tenants.map((tenant) => tenant.id),
      notificationType
    );

  const userEmails = await userService.readUsers(
    tenantUsers.map((u) => u.userId)
  );

  const tenantContactEmails = includeTenantContactEmails
    ? (
        await Promise.all(
          tenants.map(async (tenant) => ({
            tenantId: tenant.id,
            name: tenant.name,
            email: await getTenantContactEmailIfEnabled(
              tenant,
              readModelService,
              logger
            ),
          }))
        )
      ).filter(
        (
          tenantContactEmail
        ): tenantContactEmail is {
          tenantId: TenantId;
          name: string;
          email: string;
        } => tenantContactEmail.email !== undefined
      )
    : [];

  return [
    ...tenantContactEmails.map((tenantContactEmail) => ({
      tenantName: tenantContactEmail.name,
      type: "Tenant" as const,
      address: tenantContactEmail.email,
    })),
    ...userEmails.map((userEmail) => ({
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      tenantName: tenants.find(
        (tenant) =>
          tenant.id ===
          tenantUsers.find(
            (tenantUser) => tenantUser.userId === userEmail.userId
          )?.tenantId
      )!.name,
      type: "User" as const,
      address: userEmail.email,
    })),
  ];
};
