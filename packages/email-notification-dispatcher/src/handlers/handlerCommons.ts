import {
  Agreement,
  AgreementV2,
  DelegationV2,
  Attribute,
  AttributeId,
  EService,
  EServiceTemplateV2,
  EServiceTemplateVersionId,
  EServiceV2,
  NotificationConfig,
  NotificationType,
  Tenant,
  TenantId,
  tenantMailKind,
  TenantV2,
} from "pagopa-interop-models";
import { getLatestTenantMailOfKind, Logger } from "pagopa-interop-commons";
import { ReadModelServiceSQL } from "../services/readModelServiceSQL.js";
import { UserServiceSQL } from "../services/userServiceSQL.js";
import { HandlerCommonParams } from "../models/handlerParams.js";
import {
  attributeNotFound,
  certifierTenantNotFound,
  eServiceNotFound,
} from "../models/errors.js";

export type AgreementHandlerParams = HandlerCommonParams & {
  agreementV2Msg?: AgreementV2;
};

export type EServiceHandlerParams = HandlerCommonParams & {
  eserviceV2Msg?: EServiceV2;
};

export type TenantHandlerParams = HandlerCommonParams & {
  tenantV2Msg?: TenantV2;
  attributeId: AttributeId;
};

export type DelegationHandlerParams = HandlerCommonParams & {
  delegationV2Msg?: DelegationV2;
};

export type EserviceTemplateHandlerParams = HandlerCommonParams & {
  eserviceTemplateV2Msg?: EServiceTemplateV2;
  eserviceTemplateVersionId: EServiceTemplateVersionId;
};

export type EserviceTemplateNameUpdatedHandlerParams = HandlerCommonParams & {
  eserviceTemplateV2Msg?: EServiceTemplateV2;
  oldName?: string;
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

export async function retrieveAttribute(
  attributeId: AttributeId,
  readModelService: ReadModelServiceSQL
): Promise<Attribute> {
  const attribute = await readModelService.getAttributeById(attributeId);
  if (!attribute) {
    throw attributeNotFound(attributeId);
  }
  return attribute;
}

export async function retrieveTenantByCertifierId(
  certifierId: string,
  readModelService: ReadModelServiceSQL
): Promise<Tenant> {
  const tenant = await readModelService.getTenantByCertifierId(certifierId);
  if (!tenant) {
    throw certifierTenantNotFound(certifierId);
  }
  return tenant;
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

  const userEmails: string[] = (
    await userService.readUsers(tenantUsers.map((u) => u.userId))
  ).map((u) => u.email);

  const tenantContactEmails = includeTenantContactEmails
    ? (
        await Promise.all(
          tenants.map(
            async (tenant) =>
              await getTenantContactEmailIfEnabled(
                tenant,
                readModelService,
                logger
              )
          )
        )
      ).filter((email): email is string => email !== undefined)
    : [];

  return [
    ...tenantContactEmails.map((tenantContactEmail) => ({
      type: "Tenant" as const,
      address: tenantContactEmail,
    })),
    ...userEmails.map((address) => ({
      type: "User" as const,
      address,
    })),
  ];
};
