import {
  Agreement,
  AgreementV2,
  DelegationV2,
  Attribute,
  AttributeId,
  EService,
  EServiceV2,
  NotificationConfig,
  NotificationType,
  PurposeV2,
  Purpose,
  PurposeId,
  Tenant,
  TenantId,
  tenantMailKind,
  TenantV2,
  UserId,
} from "pagopa-interop-models";
import { getLatestTenantMailOfKind, Logger } from "pagopa-interop-commons";
import { match } from "ts-pattern";
import { ReadModelServiceSQL } from "../services/readModelServiceSQL.js";
import { UserServiceSQL } from "../services/userServiceSQL.js";
import { HandlerCommonParams } from "../models/handlerParams.js";
import {
  attributeNotFound,
  certifierTenantNotFound,
  eServiceNotFound,
  purposeNotFound,
} from "../models/errors.js";

export type AgreementHandlerParams = HandlerCommonParams & {
  agreementV2Msg?: AgreementV2;
};

export type EServiceHandlerParams = HandlerCommonParams & {
  eserviceV2Msg?: EServiceV2;
};

export type EServiceNameUpdatedHandlerParams = HandlerCommonParams & {
  eserviceV2Msg?: EServiceV2;
  oldName?: string;
};

export type ClientPurposeHandlerParams = HandlerCommonParams & {
  purposeId: PurposeId;
};

export type PurposeHandlerParams = HandlerCommonParams & {
  purposeV2Msg?: PurposeV2;
};

export type TenantHandlerParams = HandlerCommonParams & {
  tenantV2Msg?: TenantV2;
  attributeId: AttributeId;
};

export type DelegationHandlerParams = HandlerCommonParams & {
  delegationV2Msg?: DelegationV2;
};

type TenantEmailNotificationRecipient = {
  type: "Tenant";
  tenantId: TenantId;
  address: string;
};

type UserEmailNotificationRecipient = {
  type: "User";
  userId: UserId;
  tenantId: TenantId;
  address: string;
};

type EmailNotificationRecipient =
  | TenantEmailNotificationRecipient
  | UserEmailNotificationRecipient;

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

export async function retrievePurpose(
  purposeId: PurposeId,
  readModelService: ReadModelServiceSQL
): Promise<Purpose> {
  const purpose = await readModelService.getPurposeById(purposeId);
  if (!purpose) {
    throw purposeNotFound(purposeId);
  }
  return purpose;
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

  const usersWithEmails = await userService.readUsers(
    tenantUsers.map((u) => u.userId)
  );

  const userRecipients: UserEmailNotificationRecipient[] = tenantUsers.flatMap(
    ({ userId, tenantId }) => {
      const user = usersWithEmails.find((u) => u.userId === userId);
      if (!user) {
        logger.warn(
          `Could not retrieve email for user ${userId}, skipping notification`
        );
        return [];
      }
      return [{ type: "User" as const, userId, tenantId, address: user.email }];
    }
  );

  const tenantRecipients: TenantEmailNotificationRecipient[] =
    includeTenantContactEmails
      ? (
          await Promise.all(
            tenants.map(async (tenant) => ({
              type: "Tenant" as const,
              tenantId: tenant.id,
              address: await getTenantContactEmailIfEnabled(
                tenant,
                readModelService,
                logger
              ),
            }))
          )
        ).filter(
          (t): t is TenantEmailNotificationRecipient => t.address !== undefined
        )
      : [];

  return [...userRecipients, ...tenantRecipients];
};

export const mapRecipientToEmailPayload = (
  recipient: EmailNotificationRecipient
): { type: "User"; userId: UserId } | { type: "Tenant"; address: string } =>
  match(recipient)
    .with({ type: "User" }, ({ type, userId }) => ({
      type,
      userId,
    }))
    .with({ type: "Tenant" }, ({ type, address }) => ({
      type,
      address,
    }))
    .exhaustive();
