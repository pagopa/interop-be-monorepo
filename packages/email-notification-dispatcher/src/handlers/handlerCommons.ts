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

type EmailNotificationRecipient = { type: "Tenant" | "User"; address: string };

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

export const getTenantContactEmailIfEnabled = async (
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

export const getRecipientsForTenant = async ({
  tenant,
  notificationType,
  includeTenantContactEmail,
  readModelService,
  userService,
  logger,
}: {
  tenant: Tenant;
  notificationType: NotificationType;
  includeTenantContactEmail: boolean;
  readModelService: ReadModelServiceSQL;
  userService: UserServiceSQL;
  logger: Logger;
}): Promise<EmailNotificationRecipient[]> => {
  const tenantUsers =
    await readModelService.getTenantUsersWithNotificationEnabled(
      [tenant.id],
      notificationType
    );

  const userEmails: string[] = (
    await userService.readUsers(tenantUsers.map((u) => u.userId))
  ).map((u) => u.email);
  const tenantContactEmail = includeTenantContactEmail
    ? await getTenantContactEmailIfEnabled(tenant, readModelService, logger)
    : undefined;
  return [
    ...(tenantContactEmail !== undefined
      ? [{ type: "Tenant" as const, address: tenantContactEmail }]
      : []),
    ...userEmails.map((address) => ({
      type: "User" as const,
      address,
    })),
  ];
};

export const getConsumerRepicientsForAgreements = async ({
  agreements,
  readModelService,
  logger,
}: {
  agreements: Agreement[];
  readModelService: ReadModelServiceSQL;
  logger: Logger;
}): Promise<EmailNotificationRecipient[]> => {
  const consumers = await readModelService.getTenantsById(
    (agreements ?? []).map((agreement) => agreement.consumerId)
  );

  return consumers.flatMap((consumer) => {
    const email = getLatestTenantMailOfKind(
      consumer.mails,
      tenantMailKind.ContactEmail
    );
    if (!email) {
      logger.warn(
        `Consumer email not found for consumer ${consumer.id}, skipping email`
      );
      return [];
    }
    return [{ type: "Tenant", address: email.address }];
  });
};
